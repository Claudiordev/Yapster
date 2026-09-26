package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.BadRequestException;
import com.claudiordese.exceptions.ConflictException;
import com.claudiordese.exceptions.ForbiddenException;
import com.claudiordese.exceptions.NotFoundException;
import com.claudiordese.session.application.domain.GifFolder;
import com.claudiordese.session.application.service.result.GifLibraryResult;
import com.claudiordese.session.support.InMemoryGifLibraryStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GifLibraryServiceTest {

    private static final String CDN = "https://static.klipy.com/ii/abc/x.webp";
    private static final Set<String> FREE = Set.of("USER");
    private static final Set<String> PREMIUM = Set.of("USER", "PREMIUM");
    private static final Set<String> PREMIUM_PLUS = Set.of("USER", "PREMIUM_PLUS");

    private GifLibraryService service;
    private final UUID user = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new GifLibraryService(new InMemoryGifLibraryStore());
    }

    private UUID favorites(Set<String> roles) {
        return service.library(user, roles).folders().get(0).id();
    }

    private void save(Set<String> roles, UUID folder, String gifId, String title) {
        service.addGif(user, roles, folder, gifId, title, CDN, CDN);
    }

    @Test
    void everyoneGetsOneDefaultFavoritesFolder() {
        GifLibraryResult library = service.library(user, FREE);

        assertThat(library.folders()).hasSize(1);
        assertThat(library.folders().get(0).name()).isEqualTo("Favorites");
        assertThat(library.folders().get(0).isDefault()).isTrue();
        assertThat(service.library(user, FREE).folders()).hasSize(1);
    }

    @Test
    void freeUsersCannotCreateFolders() {
        assertThatThrownBy(() -> service.createFolder(user, FREE, "Memes"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void premiumHasFiveExtraFoldersAndPremiumPlusTwenty() {
        for (int i = 0; i < 5; i++) service.createFolder(user, PREMIUM, "Folder " + i);

        assertThatThrownBy(() -> service.createFolder(user, PREMIUM, "One more"))
                .isInstanceOf(ForbiddenException.class);

        for (int i = 5; i < 20; i++) service.createFolder(user, PREMIUM_PLUS, "Folder " + i);

        assertThatThrownBy(() -> service.createFolder(user, PREMIUM_PLUS, "Too many"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void folderNamesAreCleanedAndMustBeUniqueIgnoringCase() {
        GifFolder folder = service.createFolder(user, PREMIUM, "  Reaction   pics ");

        assertThat(folder.name()).isEqualTo("Reaction pics");
        assertThatThrownBy(() -> service.createFolder(user, PREMIUM, "reaction PICS"))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.createFolder(user, PREMIUM, "favorites"))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.createFolder(user, PREMIUM, "   "))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.createFolder(user, PREMIUM, "x".repeat(31)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void favoritesCannotBeRenamedOrDeleted() {
        UUID favorites = favorites(FREE);

        assertThatThrownBy(() -> service.renameFolder(user, favorites, "Other"))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.deleteFolder(user, favorites))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void deletingAFolderDeletesItsGifsButNotOnesAlsoSavedElsewhere() {
        UUID favorites = favorites(PREMIUM);
        UUID memes = service.createFolder(user, PREMIUM, "Memes").id();

        save(PREMIUM, memes, "a", "Only in memes");
        save(PREMIUM, memes, "b", "In both");
        save(PREMIUM, favorites, "b", "In both");

        service.deleteFolder(user, memes);

        assertThat(service.gifs(user, favorites, "")).extracting("gifId").containsExactly("b");
        assertThat(service.library(user, PREMIUM).memberships()).containsOnlyKeys("b");
        assertThatThrownBy(() -> service.gifs(user, memes, "")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void aGifCanSitInSeveralFoldersAndSavingTwiceIsHarmless() {
        UUID favorites = favorites(PREMIUM);
        UUID memes = service.createFolder(user, PREMIUM, "Memes").id();

        save(PREMIUM, favorites, "a", "Cat");
        save(PREMIUM, favorites, "a", "Cat");
        save(PREMIUM, memes, "a", "Cat");

        assertThat(service.gifs(user, favorites, "")).hasSize(1);
        assertThat(service.library(user, PREMIUM).memberships().get("a")).containsExactlyInAnyOrder(favorites, memes);
    }

    @Test
    void searchingInsideAFolderFiltersByTitle() {
        UUID favorites = favorites(FREE);

        save(FREE, favorites, "a", "Happy cat");
        save(FREE, favorites, "b", "Angry dog");

        assertThat(service.gifs(user, favorites, "CAT")).extracting("gifId").containsExactly("a");
        assertThat(service.gifs(user, favorites, "")).hasSize(2);
    }

    @Test
    void savedGifsAreLimitedByRoleButASecondFolderCopyIsFree() {
        UUID favorites = favorites(PREMIUM);
        UUID memes = service.createFolder(user, PREMIUM, "Memes").id();

        for (int i = 0; i < 300; i++) save(PREMIUM, favorites, "g" + i, "Gif " + i);

        assertThatThrownBy(() -> save(PREMIUM, favorites, "one-more", "Nope"))
                .isInstanceOf(ForbiddenException.class);
        save(PREMIUM, memes, "g0", "Gif 0");
        assertThat(service.gifs(user, memes, "")).hasSize(1);
    }

    @Test
    void freeUsersCanSaveOneHundred() {
        UUID favorites = favorites(FREE);

        for (int i = 0; i < 100; i++) save(FREE, favorites, "g" + i, "Gif " + i);

        assertThatThrownBy(() -> save(FREE, favorites, "extra", "Nope")).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void onlyHttpsLinksOnTheKlipyCdnAreAccepted() {
        UUID favorites = favorites(FREE);

        for (String bad : new String[] {
                "http://static.klipy.com/x.webp",
                "https://evil.example.com/x.webp",
                "https://static.klipy.com.evil.example/x.webp",
                "https://user@static.klipy.com/x.webp",
                "javascript:alert(1)",
                "not a url",
                ""}) {
            assertThatThrownBy(() -> service.addGif(user, FREE, favorites, "a", "t", CDN, bad))
                    .as(bad).isInstanceOf(BadRequestException.class);
            assertThatThrownBy(() -> service.addGif(user, FREE, favorites, "a", "t", bad, CDN))
                    .as(bad).isInstanceOf(BadRequestException.class);
        }
    }

    @Test
    void otherPeoplesFoldersLookLikeTheyDoNotExist() {
        UUID mine = favorites(PREMIUM);
        UUID stranger = UUID.randomUUID();

        assertThatThrownBy(() -> service.gifs(stranger, mine, "")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.addGif(stranger, PREMIUM, mine, "a", "t", CDN, CDN))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.removeGif(stranger, mine, "a")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.deleteFolder(stranger, mine)).isInstanceOf(NotFoundException.class);
    }
}
