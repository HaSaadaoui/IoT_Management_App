package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.model.dashboard.DashboardData;

import java.util.Optional;
import com.amaris.sensorprocessor.model.dashboard.Desk;
import com.amaris.sensorprocessor.service.DashboardService;
import com.amaris.sensorprocessor.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.security.Principal;
import java.util.List;

@Slf4j
@Controller
public class DashboardController {

    private final UserService userService;
    private final DashboardService dashboardService;

    @Autowired
    public DashboardController(UserService userService, DashboardService dashboardService) {
        this.userService = userService;
        this.dashboardService = dashboardService;
    }

    @GetMapping("/dashboard")
    public String dashboard(Model model, Principal principal) {
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        return "dashboard";
    }

    @GetMapping("/api/dashboard")
    @ResponseBody
    public DashboardData getDashboardData() {
        return dashboardService.getDashboardData();
    }

    @GetMapping("/api/dashboard/occupancy")
    @ResponseBody
    public List<Desk> getOccupancy(@RequestParam String floor, @RequestParam(required = false) String deskId) {
        return dashboardService.getDesksByFloor(floor, Optional.ofNullable(deskId));
    }
}

