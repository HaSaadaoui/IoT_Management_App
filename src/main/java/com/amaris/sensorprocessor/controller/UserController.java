package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.exception.CustomException;
import com.amaris.sensorprocessor.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;

@Controller
public class UserController {

    private final UserService userService;

    @Autowired
    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/manage-users")
    public String manageUsers(Model model) {
        List<User> users = userService.getAllUsers();
        model.addAttribute("users", users);
//        model.asMap().remove("user");
        String loggedUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        model.addAttribute("loggedUsername", loggedUsername);
        return "manageUsers";
    }

    @PostMapping("/manage-users/add")
    public String addUser(@ModelAttribute User user, RedirectAttributes redirectAttributes) {
        try {
            userService.save(user);
        } catch (CustomException e) {
            redirectAttributes.addFlashAttribute("error", "User already exists!");
            return "redirect:/manage-users";
        }
        redirectAttributes.addFlashAttribute("error", null);
        return "redirect:/manage-users";
    }

    @PostMapping("/manage-users/delete/{username}")
    public String deleteUser(@PathVariable String username) {
        userService.deleteUser(username);
        return "redirect:/manage-users";
    }

    @GetMapping("/manage-users/edit/{username}")
    public String editUser(@PathVariable String username, Model model) {
        List<User> users = userService.getAllUsers();
        model.addAttribute("users", users);
        User user = userService.searchUserByUsername(username);
        model.addAttribute("user", user);
        String loggedUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        model.addAttribute("loggedUsername", loggedUsername);
        return "manageUsers";
    }

    @PostMapping("/manage-users/edit")
    public String updateUser(@ModelAttribute User user, RedirectAttributes redirectAttributes) {
        userService.update(user);
        return "redirect:/manage-users";
    }
    @GetMapping("/users/{username}")
    public String viewUserProfile(@PathVariable String username, Model model, Authentication authentication) {
        String loggedUsername = authentication.getName();

        if (!username.equals(loggedUsername)) {
            return "redirect:/users/" + loggedUsername;
        }

        User user = userService.searchUserByUsername(username);
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", loggedUsername);

        return "profile";
    }

    @PostMapping("/users/{username}/change-password")
    public String changePassword(
            @PathVariable String username,
            @RequestParam String currentPassword,
            @RequestParam String newPassword,
            @RequestParam String confirmPassword,
            Authentication authentication,
            Model model
    ) {
        String loggedUsername = authentication.getName();

        // Vérifie que l'utilisateur ne change que SON mot de passe
        if (!loggedUsername.equals(username)) {
            model.addAttribute("globalError", "Vous ne pouvez changer que votre propre mot de passe.");
        } else if (!newPassword.equals(confirmPassword)) {
            model.addAttribute("errorConfirm", "Les mots de passe ne correspondent pas.");
        } else {
            try {
                userService.changePassword(username, currentPassword, newPassword);
                model.addAttribute("success", "Mot de passe changé avec succès ✅");
            } catch (IllegalArgumentException e) {
                model.addAttribute("globalError", e.getMessage());
            }
        }

        // Toujours recharger le profil (utile pour afficher infos + erreurs/succès)
        User user = userService.searchUserByUsername(username);
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", loggedUsername);

        return "profile";
    }



}
