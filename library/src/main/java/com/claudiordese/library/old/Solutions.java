package com.claudiordese.library.old;

import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Set;
import java.util.stream.Collector;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static java.util.Arrays.stream;

public class Solutions {

    public static void main(String[] args) {
        List<Integer> current = new ArrayList<>();
        backtrack(0,current);
    }
    static List<List<Integer>> response = new ArrayList<>();
    static int[] nums = new int[] {1,2,3};

    public static void backtrack(int index, List<Integer> current) {
        if (index == nums.length) {
            System.out.println(new ArrayList<>(current));
            return;
        }

        current.add(nums[index]);
        backtrack(index + 1, current);

        current.remove(current.size() - 1);
        backtrack(index + 1, current);
    }
}

class BackTracking {
    public static HashMap<Integer,char[]> board = new HashMap();

    static {
        board.put(0,new char[]{'0'});
        board.put(1,new char[]{'1'});
        board.put(2,new char[]{'a','b','c'});
        board.put(3,new char[]{'d','e','f'});
        board.put(4,new char[]{'g','h','i'});
        board.put(5,new char[]{'j','k','l'});
        board.put(6,new char[]{'m','n','o'});
        board.put(7,new char[]{'p','q','r','s'});
        board.put(8,new char[]{'t','u','v'});
        board.put(9,new char[]{'w','x','y','z'});
    }

    public static void main(String[] args) {
        task("23");
    }

    public static List<String> task(String digits) {
        List<String> response = new ArrayList<>();

        if (digits == null || digits.isEmpty()) return response;
        backtrack(digits,0,new StringBuilder(), response);

        System.out.println(new ArrayList<>(response));
        return response;
    }

    private static void backtrack(String digits,int idx, StringBuilder current, List<String> response) {
        if (idx == digits.length()) {
            response.add(current.toString());
            return;
        }

        int digit = digits.charAt(idx) - '0';

        for (char c: board.get(digit)) {
            current.append(c); //Right
            backtrack(digits, idx+1, current,response);
            current.deleteCharAt(current.length()-1);
        }
    }
}

class searchIn2D {

    public static void main(String[] args) {
        int[][] matrix = {
                {1,2,3,4},
                {5,6,7,8},
                {9,10,11,12},
                {13,14,15,16}
        };
        search(matrix,10);
    }

    static int[] search(int[][] matrix, int target) {
        int r = 0;
        int c = matrix.length - 1;

        while (r < matrix.length && c >= 0) {
            if (matrix[r][c] == target) {
                return new int[]{r, c};
            } else if (matrix[r][c] < target) {
                r++;
            } else {
                c--;
            }
            System.out.println("r" + r + " c" + c + " matrix" + matrix[r][c]);
        }
        return new int[]{-1,-1};
    }
}

class Data {

    public static void main(String[] args) {}

    /**
     * Streams have middle operations and operations to return values
     * @return
     */
    public List<String> returnEmptyValues() {
        List<String> list = List.of("198","sja","09a");

        return list.stream().filter(y -> y.isEmpty()).toList();
    }

    public List<Integer> mapSquareValue() {
        return List.of(1,2,3,4).stream().map(n -> n * n).toList();
    }
}