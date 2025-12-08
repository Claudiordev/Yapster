package com.claudiordese.session.solutions;

import java.util.Arrays;

public class Solutions {
    public static void main(String[] args) {
    }
}

//Abstract vs Interface
abstract class Vehicle {
    protected String brand;
    //Abstract method
    public abstract void start();

    //Concrete method
    public void stop() {
        System.out.println("Vehicle stopped");
    }
}
