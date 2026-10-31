package com.claudiordese.chat.application.service.utils;

import com.claudiordese.chat.application.domain.chat.Message;
import com.claudiordese.chat.application.domain.chat.types.MessageType;
import com.claudiordese.chat.application.port.persistence.ConversationStore;
import com.claudiordese.chat.application.port.persistence.MessageStore;
import com.claudiordese.exceptions.BadRequestException;
import com.claudiordese.exceptions.InterdictedException;
import com.claudiordese.exceptions.NotFound;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.text.BreakIterator;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Everything that has to hold before a reaction is added or removed.
 * <p>
 * Unicode gives every character one number, called a code point, and that number stands for a letter, a symbol or an emoji.
 */
@Component
@RequiredArgsConstructor
public class ReactionValidator {

    /** Longest accepted reaction key (the column width). The longest key in emoji-picker-react is 54. */
    private static final int MAX_REACTION_LENGTH = 64;

    /** Lowercase hex codepoints joined by dashes, e.g. "1f44d" or "1f468-200d-1f469". */
    private static final Pattern UNIFIED_KEY = Pattern.compile("[0-9a-f]{4,6}(-[0-9a-f]{4,6})*");

    private final MessageStore messages;
    private final ConversationStore conversations;

    /**
     * The user must be a member, the message must be a user message of that conversation, and the
     * reaction must be a single emoji keyed by its unified hex codepoints ("1f44d", "2764-fe0f", the
     * format emoji-picker-react returns). The key must be in canonical form, so one emoji can never be
     * stored under two spellings.
     */
    public void requireReactable(UUID conversationId, UUID userId, UUID messageId, String unified) {
        if (!conversations.isMember(conversationId, userId)) {
            throw new InterdictedException("not_a_member", "Not a member of this conversation");
        }

        // A message of another conversation is reported as missing, not as forbidden.
        Message message = messages.findById(messageId)
                .filter(m -> m.conversationId().equals(conversationId))
                .orElseThrow(() -> new NotFound("message_not_found", "Message not found"));

        if (message.type() == MessageType.SYSTEM) {
            throw new BadRequestException("system_message", "System messages cannot be reacted to");
        }

        if (unified == null || unified.length() > MAX_REACTION_LENGTH || !isSingleEmojiKey(unified)) {
            throw new BadRequestException("invalid_emoji", "A reaction must be a single emoji");
        }
    }

    /** Decodes the hex key into the emoji it names, and checks that spelling is the canonical one. */
    private static boolean isSingleEmojiKey(String unified) {
        if (!UNIFIED_KEY.matcher(unified).matches()) {
            return false;
        }

        StringBuilder emoji = new StringBuilder();
        List<String> canonical = new ArrayList<>();

        for (String hex : unified.split("-")) {
            //A radix is the base of a number system, meaning how many different digits it uses before it carries to the next place.
            //Radix 10 (decimal)
            int codePoint = Integer.parseInt(hex, 16);

            if (!Character.isValidCodePoint(codePoint)) {
                return false;
            }

            emoji.appendCodePoint(codePoint);
            canonical.add(String.format("%04x", codePoint));
        }

        return String.join("-", canonical).equals(unified) && isSingleEmoji(emoji.toString());
    }

    /** One grapheme cluster (what a person sees as a single character) made only of emoji parts. */
    private static boolean isSingleEmoji(String value) {
        BreakIterator graphemes = BreakIterator.getCharacterInstance();
        graphemes.setText(value);
        graphemes.first();

        //So if value of first is < than string length, means that it haves more than one emoji
        if (graphemes.next() != value.length()) {
            return false;
        }

        //Is this emoji made of more than one piece? Like emoji plus color selector then codePointCount 2
        boolean composed = value.codePointCount(0, value.length()) > 1;

        return value.codePoints().allMatch(cp -> isEmojiPart(cp, composed));
    }

    private static boolean isEmojiPart(int codePoint, boolean composed) {
        //Invisible helpers. They make no sense on their own:
        // 200d is the joiner that glues emoji together.
        // fe0f says "draw the previous symbol as a coloured emoji".
        // 20e3 is the square frame around a keycap digit.
        if (codePoint == 0x200D || codePoint == 0xFE0F || codePoint == 0x20E3) {
            return composed;
        }

        // These are invisible letters used to spell a region inside flag
        if (codePoint >= 0xE0020 && codePoint <= 0xE007F) {
            return composed;
        }

        //0x7F is 127 in decimal, the end of the basic ASCII range, which is the characters on a plain English
        return Character.isEmoji(codePoint) && (composed || codePoint > 0x7F);
    }
}
