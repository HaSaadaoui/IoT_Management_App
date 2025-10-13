package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.exception.CustomException;
import com.amaris.sensorprocessor.service.UserService;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.Principal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Controller
public class UserController {

    private final UserService userService;

    @Autowired
    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/manage-users")
    public String manageUsers(Model model, Principal principal) {
        List<User> users = userService.getAllUsers();
        model.addAttribute("users", users);
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
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

        // user à éditer
        User editUser = userService.searchUserByUsername(username);
        model.addAttribute("editUser", editUser);

        // user connecté
        String loggedUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        User loggedUser = userService.searchUserByUsername(loggedUsername);
        model.addAttribute("user", loggedUser);
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

    @PostMapping("/users/{username}/edit")
    public String editUserProfile(@PathVariable String username,
                                  @RequestParam String firstname,
                                  @RequestParam String lastname,
                                  @RequestParam String email,
                                  RedirectAttributes redirectAttributes) {
        try {
            userService.updateUserInfo(username, firstname, lastname, email);
            redirectAttributes.addFlashAttribute("successEdit", "Informations mises à jour avec succès.");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("errorEdit", "Erreur lors de la mise à jour des informations.");
        }
        return "redirect:/users/" + username;
    }

    @PostMapping("/users/{username}/update-avatar")
    public String updateAvatar(@PathVariable String username,
                               @RequestParam("avatar") MultipartFile avatarFile) throws IOException {

        if (!avatarFile.isEmpty()) {

            // Chemin relatif au projet
            String uploadDir = "uploads/";

            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);  // Crée le dossier si nécessaire
            }

            // Nom de fichier
            String originalFileName = avatarFile.getOriginalFilename();
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");
            String dateTime = LocalDateTime.now().format(formatter);
            String fileName = dateTime + "_" + originalFileName;

            // Sauvegarde le fichier
            Path filePath = uploadPath.resolve(fileName);
            Files.copy(avatarFile.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // URL relative pour HTML
            String avatarUrl = "/uploads/" + fileName;
            userService.updateAvatar(username, avatarUrl);

        }

        return "redirect:/users/" + username; // retour sur la page profil
    }


}
