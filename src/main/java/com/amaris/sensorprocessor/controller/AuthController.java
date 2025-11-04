package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.service.SignupService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final SignupService signupService;

    @Autowired
    public AuthController(SignupService signupService) {
        this.signupService = signupService;
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String firstname = body.get("firstname");
        String lastname = body.get("lastname");
        String email = body.get("email");
        String password = body.get("password");
        String role = body.getOrDefault("role", "USER");
        if (isBlank(username) || isBlank(firstname) || isBlank(lastname) || isBlank(email) || isBlank(password)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Missing fields"));
        }
        signupService.signup(username, firstname, lastname, email, password, role);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Verification email sent"));
    }

    @GetMapping("/verify")
    public ResponseEntity<?> verify(@RequestParam("token") String token) {
        try {
            signupService.verifyByToken(token);
            // Auto-login optionally: could be implemented by loading username, but password unknown.
            return ResponseEntity.ok(Map.of("message", "Email verified"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<?> resend(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (isBlank(email)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Email is required"));
        }
        try {
            signupService.resend(email);
            return ResponseEntity.ok(Map.of("message", "Verification email resent"));
        } catch (IllegalStateException e) {
            String msg = e.getMessage();
            if ("Already verified".equals(msg)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", msg));
            }
            if ("Too many resends".equals(msg)) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", msg));
            }
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", msg));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}


