package com.amaris.sensorprocessor.config;

import com.amaris.sensorprocessor.service.CustomUserDetailsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SpringSecurityConfig {

    private final CustomUserDetailsService customUserDetailsService;

    @Autowired
    public SpringSecurityConfig(CustomUserDetailsService customUserDetailsService) {
        this.customUserDetailsService = customUserDetailsService;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf
                        .ignoringRequestMatchers("/api/sensors/**") // Désactive CSRF pour les API REST
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/css/**", "/image/**", "/login", "/register").permitAll()
                        .requestMatchers("/verify", "/resend-verification", "/verification-success", "/verification-pending").permitAll() // Email verification endpoints
                        .requestMatchers("/api/sensors/**").permitAll() // API REST publique
                        .requestMatchers("/api/test-alerts", "/api/dashboard/**", "/api/analytics/**").permitAll() // Allow alerts, dashboard, and analytics APIs for development
                        .requestMatchers("/home").authenticated()
                        .requestMatchers("/manage-users", "/manage-users/**").hasRole("ADMIN")
                        .requestMatchers("/configuration", "/configuration/**").hasRole("ADMIN")
                        .anyRequest().hasAnyRole("ADMIN", "USER", "SUPERUSER")
                )
                .formLogin(form -> form
                        .loginPage("/login")
                        .permitAll()
                        .defaultSuccessUrl("/home", true)
                )
                .logout(logout -> logout
                        .logoutUrl("/logout")
                        .logoutSuccessUrl("/login?logout")
                        .permitAll()
                )
//                .sessionManagement(session -> session
//                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
//                )
                .build();
    }

    /**
     * Crée et retourne un {@link BCryptPasswordEncoder}.
     * Cet encodeur est utilisé pour hacher les mots de passe avec l'algorithme BCrypt.
     *
     * @return une nouvelle instance de {@link BCryptPasswordEncoder}.
     */
    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Crée et configure un {@link AuthenticationManager} avec un {@link BCryptPasswordEncoder}.
     * Ce manager est utilisé pour l'authentification des utilisateurs en utilisant un service de détails utilisateur personnalisé.
     *
     * @param http l'objet HttpSecurity utilisé pour configurer la sécurité.
     * @param bCryptPasswordEncoder le password encoder utilisé pour encoder les mots de passe.
     * @return l'instance configurée de {@link AuthenticationManager}.
     * @throws Exception si une erreur se produit lors de la configuration.
     */
    @Bean
    public AuthenticationManager authenticationManager(HttpSecurity http, BCryptPasswordEncoder bCryptPasswordEncoder) throws Exception {
        AuthenticationManagerBuilder authenticationManagerBuilder = http.getSharedObject(AuthenticationManagerBuilder.class);
        authenticationManagerBuilder.userDetailsService(customUserDetailsService).passwordEncoder(bCryptPasswordEncoder);
        return authenticationManagerBuilder.build();
    }

}
