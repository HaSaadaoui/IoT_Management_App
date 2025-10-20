package com.amaris.sensorprocessor;

import com.amaris.sensorprocessor.repository.PendingUserDao;
import com.amaris.sensorprocessor.service.EmailService;
import com.amaris.sensorprocessor.service.SignupService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;

@SpringBootTest
class SignupFlowTests {

    @Autowired
    private SignupService signupService;

    @Autowired
    private PendingUserDao pendingUserDao;

    @MockBean(name = "emailServiceAcs")
    private EmailService emailService;

    @Test
    void signup_insertsPending() {
        String email = "test-signup@example.com";
        try { pendingUserDao.deleteByEmail(email); } catch (Exception ignored) {}
        
        // Mock email sending to avoid real ACS calls
        doNothing().when(emailService).sendVerificationEmail(anyString(), anyString());
        
        signupService.signup("tester","Test","User", email, "Password123!", "USER");
        assertTrue(pendingUserDao.findByEmail(email).isPresent());
    }
}


