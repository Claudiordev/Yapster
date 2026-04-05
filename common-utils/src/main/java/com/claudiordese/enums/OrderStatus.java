package com.claudiordese.enums;

import java.util.Arrays;
import java.util.stream.Collectors;

public enum OrderStatus {
    MATCHED,
    FAILED,
    ERROR,
    SKIPPED;

    /**
     * Converts value string input to String UpperCase and retrieves Enum of it
     * @param value enum input
     * @return OrderStatus Enum from String value input
     */
    public static OrderStatus fromString(String value) {
        try {
            return OrderStatus.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Invalid order status: '" + value + "'. Valid values: " + validValues());
        }
    }

    /**
     * @return String list of Enum entries ["ENUM_VALUE", "ENUM_VALUE"]
     */
    public static String validValues() {
        return Arrays.stream(values())
                .map(Enum::name)
                .collect(Collectors.joining(", "));
    }
}
