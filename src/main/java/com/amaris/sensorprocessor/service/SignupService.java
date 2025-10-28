package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.PendingUser;
import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.repository.PendingUserDao;
import com.amaris.sensorprocessor.repository.UserDao;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class SignupService {

    private static final Logger log = LoggerFactory.getLogger(SignupService.class);

    private final PendingUserDao pendingUserDao;
    private final UserDao userDao;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Value("${app.verification.token.hash:true}")
    private boolean hashTokens;

    @Value("${app.verification.validity-hours:24}")
    private int validityHours;

    @Value("${app.verification.base-url:http://localhost:8080}")
    private String baseUrl;

    @Value("${app.verification.resend.maxPerHour:3}")
    private int maxResendPerHour;

    @Value("${app.verification.autoLoginAfterVerify:false}")
    private boolean autoLoginAfterVerify;

    public SignupService(PendingUserDao pendingUserDao, 
                         UserDao userDao, 
                         PasswordEncoder passwordEncoder, 
                         @Qualifier("emailServiceAcs") EmailService emailService) {
        this.pendingUserDao = pendingUserDao;
        this.userDao = userDao;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        log.info("✅ SignupService initialized with Azure Communication Services (ACS)");
    }

    public void signup(String username, String firstname, String lastname, String email, String rawPassword, String role) {
        log.info("Signup request for username: {}, email: {}", username, email);
        
        if (userDao.findByUsername(username).isPresent()) {
            log.warn("Signup failed: User already exists with username: {}", username);
            throw new IllegalArgumentException("User already exists");
        }
        Optional<PendingUser> existing = pendingUserDao.findByEmail(email);
        if (existing.isPresent()) {
            log.info("Deleting existing pending user for email: {}", email);
            pendingUserDao.deleteByEmail(email);
        }

        String bcrypt = passwordEncoder.encode(rawPassword);
        log.debug("Password encoded, BCrypt length: {}", bcrypt.length());
        
        String token = generateToken();
        String tokenToStore = hashTokens ? sha256Hex(token) : token;
        Instant expiresAt = Instant.now().plus(Duration.ofHours(validityHours));

        PendingUser p = new PendingUser();
        p.setEmail(email);
        p.setUsername(username);
        p.setFirstname(firstname);
        p.setLastname(lastname);
        p.setPassword(bcrypt);
        p.setRole(role == null || role.isBlank() ? "USER" : role);
        p.setIcon("/image/default-avatar.png");
        p.setTokenHash(tokenToStore);
        p.setExpiresAt(expiresAt);
        p.setResendCount(0);
        p.setLastResendAt(null);

        pendingUserDao.insert(p);
        log.info("Pending user created for email: {}, expires at: {}", email, expiresAt);
        
        String verifyLink = buildVerifyLink(token);
        log.info("Verification link generated: {}", verifyLink);
        sendEmail(email, verifyLink);
    }

    @Transactional
    public void verifyByToken(String token) {
        log.info("Verification attempt with token: {}...", token.substring(0, Math.min(10, token.length())));
        
        String lookup = hashTokens ? sha256Hex(token) : token;
        PendingUser pending = pendingUserDao.findByTokenHash(lookup)
                .orElseThrow(() -> {
                    log.error("Verification failed: Invalid or expired token");
                    return new IllegalArgumentException("Invalid or expired token");
                });
        
        log.info("Found pending user: {}, email: {}", pending.getUsername(), pending.getEmail());
        
        if (pending.getExpiresAt().isBefore(Instant.now())) {
            log.warn("Token expired for user: {}, expired at: {}", pending.getEmail(), pending.getExpiresAt());
            pendingUserDao.deleteByEmail(pending.getEmail());
            throw new IllegalArgumentException("Token expired");
        }
        
        User user = new User(
                pending.getUsername(),
                pending.getFirstname(),
                pending.getLastname(),
                pending.getPassword(),
                pending.getRole(),
                pending.getEmail(),
                pending.getIcon()
        );
        
        log.info("Creating verified user: {}", user.getUsername());
        userDao.insertUser(user);
        pendingUserDao.deleteByEmail(pending.getEmail());
        log.info("User verification completed successfully for: {}", user.getEmail());
        // Optional auto-login handled in controller layer if needed
    }

    @Transactional
    public void resend(String email) {
        log.info("Resend verification for email: {}", email);
        
        PendingUser pending = pendingUserDao.findByEmail(email)
            .orElseThrow(() -> {
                log.warn("No pending user found for email: {}", email);
                return new IllegalArgumentException("No pending verification found for this email. Please register first.");
            });
        
        // Check if already verified
        if (userDao.findByUsername(pending.getUsername()).isPresent()) {
            log.warn("User already verified: {}", pending.getUsername());
            throw new IllegalStateException("This email is already verified. You can login now.");
        }
        
        Instant now = Instant.now();
        
        // Rate limiting check
        if (pending.getLastResendAt() != null && Duration.between(pending.getLastResendAt(), now).toHours() < 1) {
            if (pending.getResendCount() != null && pending.getResendCount() >= maxResendPerHour) {
                log.warn("Too many resend attempts for email: {}", email);
                throw new IllegalStateException("Too many resend attempts. Please wait an hour before trying again.");
            }
        } else {
            pending.setResendCount(0);
        }

        String token = generateToken();
        String tokenToStore = hashTokens ? sha256Hex(token) : token;
        Instant newExpiry = now.plus(Duration.ofHours(validityHours));
        int newCount = (pending.getResendCount() == null ? 0 : pending.getResendCount()) + 1;
        
        log.info("Updating token for email: {}, resend count: {}", email, newCount);
        pendingUserDao.updateTokenAndResend(email, tokenToStore, newExpiry, newCount, now);
        
        String verifyLink = buildVerifyLink(token);
        log.info("Sending resend verification email to: {}", email);
        sendEmail(email, verifyLink);
        log.info("Resend verification email sent successfully to: {}", email);
    }

    public int cleanupExpired() {
        return pendingUserDao.deleteExpired(Instant.now());
    }

    private void sendEmail(String to, String link) {
        log.info("Sending verification email via Azure Communication Services to: {}", to);
        try {
            emailService.sendVerificationEmail(to, link);
            log.info("✅ Verification email sent successfully to: {}", to);
        } catch (Exception e) {
            log.error("❌ Failed to send verification email to: {}. Error: {}", to, e.getMessage(), e);
            throw new RuntimeException("Failed to send verification email via ACS: " + e.getMessage(), e);
        }
    }

    private String buildVerifyLink(String token) {
        // Use /verify for web page with beautiful UI (not /api/auth/verify which returns JSON)
        return baseUrl + "/verify?token=" + token;
    }

    private static String generateToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(input.getBytes());
            return HexFormat.of().formatHex(d);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}


