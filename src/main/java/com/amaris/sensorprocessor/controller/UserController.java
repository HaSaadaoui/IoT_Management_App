package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.exception.CustomException;
import com.amaris.sensorprocessor.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
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

@Controller
public class UserController {

    private final UserService userService;

    @Autowired
    public UserController(UserService userService) {
        this.userService = userService;
    }

    // -----------------------
    // Helpers security
    // -----------------------
    private boolean hasRole(Authentication auth, String role) {
        if (auth == null) return false;
        String wanted = "ROLE_" + role;
        for (GrantedAuthority ga : auth.getAuthorities()) {
            if (wanted.equals(ga.getAuthority())) return true;
        }
        return false;
    }

    private String resolveLoggedRole(Authentication auth) {
        if (hasRole(auth, "ADMIN")) return "ADMIN";
        if (hasRole(auth, "SUPERUSER")) return "SUPERUSER";
        if (hasRole(auth, "USER")) return "USER";
        return "";
    }

    @GetMapping("/manage-users")
    public String manageUsers(Model model, Principal principal, Authentication authentication) {
        List<User> users = userService.getAllUsers();
        model.addAttribute("users", users);

        User loggedUser = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", loggedUser);
        model.addAttribute("loggedUsername", loggedUser.getUsername());

        // ✅ nécessaire pour ton HTML (th:disabled)
        model.addAttribute("loggedRole", resolveLoggedRole(authentication));

        return "manageUsers";
    }

    @PostMapping("/manage-users/add")
    public String addUser(@ModelAttribute User user,
                          RedirectAttributes redirectAttributes,
                          Authentication authentication) {
        try {
            // ✅ BACKEND RULE: SUPERUSER ne peut créer que USER (écrase tout)
            if (hasRole(authentication, "SUPERUSER")) {
                user.setRole("USER"); // adapte si ton type Role est un enum
            }

            userService.save(user);

        } catch (CustomException e) {
            redirectAttributes.addFlashAttribute("error", "User already exists!");
            return "redirect:/manage-users";
        }

        redirectAttributes.addFlashAttribute("error", null);
        return "redirect:/manage-users";
    }

    @PostMapping("/manage-users/delete/{username}")
    public String deleteUser(@PathVariable String username,
                             RedirectAttributes redirectAttributes,
                             Authentication authentication) {

        // utilisateur connecté
        String loggedUsername = authentication.getName();
        User loggedUser = userService.searchUserByUsername(loggedUsername);

        // cible
        User target = userService.searchUserByUsername(username);

        // ✅ ne jamais pouvoir se supprimer soi-même (déjà côté UI, mais on sécurise)
        if (username.equalsIgnoreCase(loggedUsername)) {
            redirectAttributes.addFlashAttribute("error", "You cannot delete your own account.");
            return "redirect:/manage-users";
        }

        // ✅ SUPERUSER: restrictions de delete (recommandé)
        if (hasRole(authentication, "SUPERUSER")) {
            // ex: superuser ne peut pas supprimer admin / superuser
            if ("ADMIN".equalsIgnoreCase(target.getRole()) || "SUPERUSER".equalsIgnoreCase(target.getRole())) {
                redirectAttributes.addFlashAttribute("error", "You cannot delete this user.");
                return "redirect:/manage-users";
            }
        }

        userService.deleteUser(username);
        return "redirect:/manage-users";
    }

    @GetMapping("/manage-users/edit/{username}")
    public String editUser(@PathVariable String username, Model model, Authentication authentication) {
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

        // ✅ nécessaire pour ton HTML (th:disabled)
        model.addAttribute("loggedRole", resolveLoggedRole(authentication));

        return "manageUsers";
    }

    @PostMapping("/manage-users/edit")
    public String updateUser(@ModelAttribute User user,
                             RedirectAttributes redirectAttributes,
                             Authentication authentication) {

        // ✅ récupère l’existant en base pour éviter l’escalade par POST
        User existing = userService.searchUserByUsername(user.getUsername());

        // champs autorisés
        existing.setFirstname(user.getFirstname());
        existing.setLastname(user.getLastname());
        existing.setEmail(user.getEmail());

        // ✅ BACKEND RULE: SUPERUSER ne peut pas changer les rôles (ignore le champ role)
        if (!hasRole(authentication, "SUPERUSER")) {
            existing.setRole(user.getRole());
        }

        userService.update(existing);
        return "redirect:/manage-users";
    }

    // -----------------------
    // Profile
    // -----------------------
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
            String uploadDir = "uploads/";
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            String originalFileName = avatarFile.getOriginalFilename();
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");
            String dateTime = LocalDateTime.now().format(formatter);
            String fileName = dateTime + "_" + originalFileName;

            Path filePath = uploadPath.resolve(fileName);
            Files.copy(avatarFile.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            String avatarUrl = "/uploads/" + fileName;
            userService.updateAvatar(username, avatarUrl);
        }

        return "redirect:/users/" + username;
    }
}