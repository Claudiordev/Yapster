package com.claudiordese.library.model.domain;

import com.claudiordese.library.global.JSONSerializer;
import com.claudiordese.library.model.dto.PlayerDTO;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;


@Data
@EqualsAndHashCode(callSuper = false)
public class GameRoom extends JSONSerializer {
    private UUID uuid;
    private String name;
    private List<PlayerDTO> players;
    private char[][] board = new char[3][3];
    private List<Move> moves;
    private PlayerDTO winner = null;

    public GameRoom(String name) {
        this.uuid = UUID.randomUUID();
        this.name = name;
        this.players = new ArrayList<>();
        this.moves = new ArrayList<>();

        for(int y = 0; y < 3; y++) {
            for(int x = 0; x < 3; x++) {
                this.board[y][x] = '-';
            }
        }
    }

    /**
     * Do a move on the board
     * @param move
     * @return
     */
    public boolean move(Move move) {
        char symbol = move.getSymbol();
        int y = move.getY();
        int x = move.getX();

        if (winner != null) {
            return false;
        }

        if (board[y][x] != '-') {
            return false;
        }

        if (x < 0 || x > 2 || y < 0 || y > 2) {
            return false;
        }

        board[y][x] = symbol;
        moves.add(move);

        if (detectWinner(move)) {
            winner = move.getPlayer();
        }

        return true;
    }

    /**
     * Detect if there's a winner on the game
     * @param move
     * @return
     */
    public boolean detectWinner(Move move) {
        char symbol = move.getSymbol();

        for (int y = 0; y < this.board.length; y++) {
            if (board[y][0] == symbol && board[y][1] == symbol && board[y][2] == symbol) {
                return true;
            }
        }

        for (int x = 0; x < this.board.length; x++) {
            if (board[0][x] == symbol && board[1][x] == symbol && board[2][x] == symbol) {
                return true;
            }
        }

        if (board[0][0] == symbol && board[1][1] == symbol && board[2][2] == symbol) {
            return true;
        }

        if (board[0][2] == symbol && board[1][1] == symbol && board[2][0] == symbol) {
            return true;
        }

        return false;
    }

    /**
     * Print board
     * @return
     */
    public String boardToString() {
        StringBuilder sb = new StringBuilder();

        for (int y = 0; y < board.length; y++) {
            for (int x = 0; x < board[y].length; x++) {
                sb.append(board[y][x]);
                if (x < board[y].length - 1) {
                    sb.append(" | "); // separator between cells
                }
            }
            sb.append("\n");
            if (y < board.length - 1) {
                sb.append("--+---+--\n"); // separator between rows
            }
        }

        return sb.toString();
    }
}
