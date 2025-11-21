package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.service.SignupService;
import com.amaris.sensorprocessor.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.security.Principal;

@Controller
public class HomeController {

    private static final Logger log = LoggerFactory.getLogger(HomeController.class);
    private final UserService userService;
    private final SignupService signupService;

    @Autowired
    public HomeController(UserService userService, SignupService signupService) {
        this.userService = userService;
        this.signupService = signupService;
    }
    /**
     * @return la vue "login" pour afficher la page de connexion.
     */
    @GetMapping("/login")
    public String loginPage() {
        return "login";
    }

    /**
     * @return la vue "home" pour afficher la page d'accueil.
     */
    @GetMapping("/home")
    public String home(Model model, Principal principal) {
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        return "home";
    }

    /**
     * @return la vue "dashboard" pour afficher le dashboard de monitoring et analytics.
     */
    @GetMapping("/dashboard")
    public String dashboard(Model model, Principal principal) {
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        return "dashboard";
    }

    /**
     * @return la vue "register" pour afficher la page d'inscrition.
     */
    @GetMapping("/register")
    public String registerPage() {
        return "register";
    }

    @PostMapping("/register")
    public String addUser(@ModelAttribute User user, RedirectAttributes redirectAttributes, Model model) {
        try {
            log.info("Web registration attempt for username: {}, email: {}", user.getUsername(), user.getEmail());
            
            // Use SignupService for email verification instead of direct user creation
            signupService.signup(
                user.getUsername(),
                user.getFirstname(),
                user.getLastname(),
                user.getEmail(),
                user.getPassword(),
                user.getRole() != null ? user.getRole() : "USER"
            );
            
            // Redirect to "check your email" page
            model.addAttribute("email", user.getEmail());
            return "verification-pending";
            
        } catch (IllegalArgumentException e) {
            log.warn("Registration failed: {}", e.getMessage());
            redirectAttributes.addFlashAttribute("error", e.getMessage());
            return "redirect:/register";
        } catch (Exception e) {
            log.error("Registration error: {}", e.getMessage(), e);
            redirectAttributes.addFlashAttribute("error", "Registration failed. Please try again.");
            return "redirect:/register";
        }
    }
    
    @GetMapping("/verify")
    public String verifyEmail(@RequestParam("token") String token, Model model) {
        try {
            log.info("Web verification attempt with token");
            signupService.verifyByToken(token);
            model.addAttribute("success", true);
            return "verification-success";
        } catch (IllegalArgumentException e) {
            log.error("Verification failed: {}", e.getMessage());
            model.addAttribute("success", false);
            model.addAttribute("error", e.getMessage());
            return "verification-success";
        }
    }
    
    @GetMapping("/resend-verification")
    public String resendVerificationPage() {
        return "resend-verification";
    }
    
    @PostMapping("/resend-verification")
    public String resendVerification(@RequestParam("email") String email, Model model) {
        try {
            log.info("Resend verification request for email: {}", email);
            signupService.resend(email);
            model.addAttribute("success", true);
            model.addAttribute("message", "Verification email resent successfully!");
            model.addAttribute("email", email);
            return "verification-pending";
        } catch (Exception e) {
            log.error("Resend verification failed: {}", e.getMessage());
            model.addAttribute("error", e.getMessage());
            return "resend-verification";
        }
    }

}
