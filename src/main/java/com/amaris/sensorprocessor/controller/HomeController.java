package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.exception.CustomException;
import com.amaris.sensorprocessor.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import com.amaris.sensorprocessor.service.UserService;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
public class HomeController {

    private final UserService userService;

    @Autowired
    public HomeController(UserService userService) {
        this.userService = userService;
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
    public String home(Model model) {
        String loggedUsername = SecurityContextHolder.getContext()
                .getAuthentication()
                .getName();

        // Ajout d'un attribut au modèle Thymeleaf
        model.addAttribute("loggedUsername", loggedUsername);

        return "home";
    }

    /**
     * @return la vue "register" pour afficher la page d'inscrition.
     */
    @GetMapping("/register")
    public String registerPage() {
        return "register";
    }

    @PostMapping("/register")
    public String addUser(@ModelAttribute User user, RedirectAttributes redirectAttributes) {
        try {
            userService.save(user);
        } catch (CustomException e) {
            redirectAttributes.addFlashAttribute("error", "User already exists!");
            return "redirect:/register";
        }
        redirectAttributes.addFlashAttribute("error", null);
        return "redirect:/login?registered";
    }

}
