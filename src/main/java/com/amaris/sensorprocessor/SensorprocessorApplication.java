package com.amaris.sensorprocessor;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.TimeZone;

@SpringBootApplication
public class SensorprocessorApplication implements CommandLineRunner {

	public static void main(String[] args) {
		// Set default timezone to UTC for the entire application
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
		SpringApplication.run(SensorprocessorApplication.class, args);
	}

	@Override
	public void run(String... args) {}

}
