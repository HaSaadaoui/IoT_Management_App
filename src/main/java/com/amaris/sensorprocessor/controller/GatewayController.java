package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.constant.Constants;
import com.amaris.sensorprocessor.constant.FrequencyPlan;
import com.amaris.sensorprocessor.entity.Building;
import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.GatewayValueType;
import com.amaris.sensorprocessor.entity.Protocol;
import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.service.*;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindingResult;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.security.Principal;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Controller
public class GatewayController {

    private final GatewayService gatewayService;
    private final InputValidationService inputValidationService;
    private final GatewayLorawanService gatewayLorawanService;
    private final UserService userService;
    private final BuildingService buildingService;
    private final ProtocolService protocolService;
    private final LocationService locationService;

    private static final String ERROR_ADD = "errorAdd";
    private static final String GATEWAY_ADD = "gatewayAdd";
    private static final String ERROR_EDIT = "errorEdit";
    private static final String GATEWAY_EDIT = "gatewayEdit";
    private static final String ERROR_DELETE = "errorDelete";

    @Autowired
    public GatewayController(GatewayService gatewayService,
                             InputValidationService inputValidationService,
                             GatewayLorawanService gatewayLorawanService,
                             UserService userService,
                             BuildingService buildingService,
                             ProtocolService protocolService,
                             LocationService locationService) {
        this.gatewayService = gatewayService;
        this.inputValidationService = inputValidationService;
        this.gatewayLorawanService = gatewayLorawanService;
        this.userService = userService;
        this.buildingService = buildingService;
        this.protocolService = protocolService;
        this.locationService = locationService;
    }

    @GetMapping("/manage-gateways")
    public String manageGateways(Model model, Principal principal) {
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        prepareModel(model);
        return Constants.PAGE_MANAGE_GATEWAYS;
    }

    /**
     * Gère les requêtes POST sur /manage-gateways pour éviter l’erreur 405
     * en cas de navigation arrière/avant ou de rafraîchissement.
     * La méthode redirige systématiquement vers la liste des gateways
     * avec un horodatage pour forcer le rafraîchissement et éviter le cache.
     *
     * @param model modèle MVC pour la vue (non utilisé ici mais nécessaire pour la signature)
     * @return redirection vers la liste des gateways avec horodatage
     */
    @PostMapping("/manage-gateways")
    public String handleManageGatewaysPost(Model model) {
        return redirectWithTimestamp();
    }

    @PostMapping("/manage-gateways/add")
    public String addGateway(@ModelAttribute(GATEWAY_ADD) Gateway gateway,BindingResult bindingResult, Model model) {
        model.addAttribute(GATEWAY_ADD, gateway);
        inputValidationService.validateGatewayForCreateForm(gateway, bindingResult);
        if (bindingResult.hasErrors()) {
            prepareModel(model);
            model.addAttribute(Constants.BINDING_GATEWAY_ADD, bindingResult);
            model.addAttribute(ERROR_ADD, Constants.INPUT_ERROR);
            return Constants.PAGE_MANAGE_GATEWAYS;
        }
        gatewayLorawanService.saveGatewayInLorawan(gateway, bindingResult);
        if (bindingResult.hasErrors()) {
            prepareModel(model);
            if (bindingResult.hasFieldErrors(Constants.BINDING_GATEWAY_ID)) {
                model.addAttribute(ERROR_ADD, Constants.GATEWAY_ID_EXISTS);
            } else if (bindingResult.hasFieldErrors(Constants.BINDING_GATEWAY_EUI)) {
                model.addAttribute(ERROR_ADD, Constants.GATEWAY_EUI_EXISTS);
            } else {
                model.addAttribute(ERROR_ADD, Constants.LORAWAN_PROBLEM);
            }
            model.addAttribute(Constants.BINDING_GATEWAY_ADD, bindingResult);
            return Constants.PAGE_MANAGE_GATEWAYS;
        }
        gatewayService.saveGatewayInDatabase(gateway, bindingResult);
        if (bindingResult.hasErrors()) {
            prepareModel(model);
            if (bindingResult.hasFieldErrors(Constants.BINDING_GATEWAY_ID)) {
                model.addAttribute(ERROR_ADD, Constants.GATEWAY_ID_EXISTS);
            } else {
                model.addAttribute(ERROR_ADD, Constants.DATABASE_PROBLEM);
            }
            return Constants.PAGE_MANAGE_GATEWAYS;
        }
        model.addAttribute(ERROR_ADD, null);
        return redirectWithTimestamp();
    }

    /**
     * Gère les requêtes GET sur /manage-gateways/add pour éviter l’erreur 405
     * en cas de navigation arrière/avant ou de rafraîchissement.
     * La route attend normalement des requêtes POST pour la soumission du formulaire.
     * Cette méthode redirige systématiquement vers la liste des gateways,
     * empêchant ainsi les erreurs liées aux requêtes GET non gérées.
     *
     * @return redirection vers la liste des gateways avec horodatage pour éviter le cache
     */
    @GetMapping("/manage-gateways/add")
    public String handleAddGet() {
        return redirectWithTimestamp();
    }

    @PostMapping("/manage-gateways/delete/{gatewayId}")
    public String deleteGateway(@PathVariable String gatewayId, Model model) {
        BindingResult bindingResult = new BeanPropertyBindingResult(new Gateway(), "deleteGateway");
        gatewayLorawanService.deleteGatewayInLorawan(gatewayId, bindingResult);
        ObjectError globalError = bindingResult.getGlobalError();
        if (globalError != null) {
            prepareModel(model);
            if (Constants.BINDING_GATEWAY_ID.equals(globalError.getCode())) {
                model.addAttribute(ERROR_DELETE, Constants.GATEWAY_NOT_FOUND);
            } else if ("permissionDenied".equals(globalError.getCode())) {
                model.addAttribute(ERROR_DELETE, Constants.PERMISSION_DENIED);
            } else if ("gatewayProblem".equals(globalError.getCode())) {
                model.addAttribute(ERROR_DELETE, Constants.GATEWAY_PROBLEM);
            } else {
                model.addAttribute(ERROR_DELETE, Constants.LORAWAN_PROBLEM);
            }
            return Constants.PAGE_MANAGE_GATEWAYS;
        }
        gatewayService.deleteGatewayInDatabase(gatewayId, bindingResult);
        globalError = bindingResult.getGlobalError();
        if (globalError != null) {
            prepareModel(model);
            if (Constants.BINDING_GATEWAY_ID.equals(globalError.getCode())) {
                model.addAttribute(ERROR_DELETE, Constants.GATEWAY_NOT_FOUND);
            } else {
                model.addAttribute(ERROR_DELETE, Constants.DATABASE_PROBLEM);
            }
            return Constants.PAGE_MANAGE_GATEWAYS;
        }
        model.addAttribute(ERROR_DELETE, null);
        return redirectWithTimestamp();
    }

    @GetMapping("/manage-gateways/edit/{gatewayId}")
    public String editGateway(@PathVariable String gatewayId, Model model, Principal principal) {
        prepareModel(model);
        Gateway gateway;
        try {
            gateway = gatewayService.searchGatewayById(gatewayId);
            model.addAttribute(GATEWAY_EDIT, gateway);
            if (gateway == null) {
                model.addAttribute(ERROR_EDIT, Constants.GATEWAY_DONT_EXISTS);
            }
        } catch (Exception e) {
            model.addAttribute(ERROR_EDIT, Constants.DATABASE_PROBLEM);
            model.addAttribute(GATEWAY_EDIT, new Gateway());
        }
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        return Constants.PAGE_MANAGE_GATEWAYS;
    }

    @PostMapping("/manage-gateways/edit")
    public String updateGateway(@ModelAttribute(GATEWAY_EDIT) Gateway gateway,BindingResult bindingResult, Model model) {
        model.addAttribute(GATEWAY_EDIT, gateway);
        inputValidationService.validateGatewayForUpdateForm(gateway, bindingResult);
        if (bindingResult.hasErrors()) {
            prepareModel(model);
            model.addAttribute(Constants.BINDING_GATEWAY_EDIT, bindingResult);
            model.addAttribute(ERROR_EDIT, Constants.INPUT_ERROR);
            return Constants.PAGE_MANAGE_GATEWAYS;
        }
        gatewayLorawanService.updateGatewayInLorawan(gateway, bindingResult);
        if (bindingResult.hasErrors()) {
            prepareModel(model);
            ObjectError globalError = bindingResult.getGlobalError();
            if (bindingResult.hasFieldErrors(Constants.BINDING_GATEWAY_ID)) {
                model.addAttribute(ERROR_EDIT, Constants.GATEWAY_NOT_FOUND);
            } else if (globalError != null && "permissionDenied".equals(globalError.getCode())) {
                model.addAttribute(ERROR_EDIT, Constants.PERMISSION_DENIED);
            } else {
                model.addAttribute(ERROR_EDIT, Constants.LORAWAN_PROBLEM);
            }
            model.addAttribute(Constants.BINDING_GATEWAY_EDIT, bindingResult);
            return Constants.PAGE_MANAGE_GATEWAYS;
        }
        gatewayService.updateGatewayInDatabase(gateway, bindingResult);
        if (bindingResult.hasErrors()) {
            prepareModel(model);
            if (bindingResult.hasFieldErrors(Constants.BINDING_GATEWAY_ID)) {
                model.addAttribute(ERROR_EDIT, Constants.GATEWAY_NOT_FOUND);
            } else {
                model.addAttribute(ERROR_EDIT, Constants.DATABASE_PROBLEM);
            }
            return Constants.PAGE_MANAGE_GATEWAYS;
        }
        model.addAttribute(ERROR_EDIT, null);
        return redirectWithTimestamp();
    }

    /**
     * Gère les requêtes GET sur /manage-gateways/edit pour éviter l’erreur 405
     * en cas de navigation arrière/avant ou de rafraîchissement.
     * La route attend normalement des requêtes POST pour la soumission du formulaire.
     * Si un GET sans gatewayId est reçu (ex : rafraîchissement ou navigation),
     * la méthode redirige vers la liste des gateways pour éviter l’erreur.
     * Si gatewayId est présent, elle affiche le formulaire d’édition via editGateway().
     *
     * @param gatewayId identifiant optionnel du gateway à éditer
     * @param model modèle MVC pour la vue
     * @return vue à afficher ou redirection vers la liste des gateways avec horodatage pour éviter le cache
     */
    @GetMapping("/manage-gateways/edit")
    public String handleEditGet(@RequestParam(required = false) String gatewayId, Model model, Principal principal) {
        if (gatewayId == null) {
            return redirectWithTimestamp();
        }
        return editGateway(gatewayId, model, principal);
    }

    /**
     * Affiche la page de monitoring en injectant l'ID de la gateway et son IP.
     *
     * @param id ID de la gateway à monitorer
     * @param ip Adresse IP de la gateway
     * @param model Modèle pour passer les données à la vue Thymeleaf
     * @return Nom de la vue Thymeleaf "monitoringGateway"
     */
    @GetMapping("/manage-gateways/monitoring/{id}/view")
    public String monitoringView(@PathVariable("id") String id, @RequestParam("ip") String ip, Model model, Principal principal) {
        model.addAttribute(Constants.BINDING_GATEWAY_ID, id);
        model.addAttribute("ipAddress", ip);
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());

        String locationName = gatewayService.findById(id)
                .filter(gw -> gw.getLocationId() != null)
                .flatMap(gw -> locationService.findById(gw.getLocationId()))
                .map(loc -> loc.getName())
                .orElse(null);
        model.addAttribute("gatewayLocationName", locationName);

        return Constants.PAGE_MONITORING_GATEWAYS;
    }

    /**
     * Stream en temps réel les données de monitoring d'une gateway via SSE.
     *
     * @param id ID de la gateway
     * @param ip Adresse IP de la gateway
     * @param httpSession la session utilisateur
     * @return SseEmitter pour transmettre les données en continue au client
     */
    @GetMapping(value = "/manage-gateways/monitoring/{id}/stream", produces = "text/event-stream")
    public SseEmitter streamMonitoringData(@PathVariable("id") String id, @RequestParam("ip") String ip, HttpSession httpSession) {
        SseEmitter emitter = new SseEmitter(3600000L);
//        String sessionKey = id + "-" + httpSession.getId();
        String sessionKey = id + "-" + httpSession.getId() + "-" + System.currentTimeMillis();

        emitter.onCompletion(() -> {
            System.out.println("\u001B[31m" + "Client disconnected, cancelling subscription" + "\u001B[0m");
            gatewayService.stopMonitoring(id, sessionKey);
        });

        emitter.onTimeout(() -> {
            System.out.println("\u001B[31m" + "SSE timeout, cancelling subscription" + "\u001B[0m");
            gatewayService.stopMonitoring(id, sessionKey);
            emitter.complete();
        });

        var subscription = gatewayService.getMonitoringData(id, ip, sessionKey)
            .subscribe(data -> {
                try {
                    emitter.send(data);
                } catch (IOException e) {
                    emitter.completeWithError(e);
                }
            }, emitter::completeWithError, emitter::complete);

        emitter.onCompletion(subscription::dispose);
        emitter.onTimeout(subscription::dispose);

        return emitter;
    }

    @GetMapping(value = "/manage-gateways/monitoring/{gatewayId}/{valueType}")
    @ResponseBody
    public LinkedHashMap<LocalDateTime, String> getGatewayDataByPeriod(
            @PathVariable String gatewayId,
            @PathVariable GatewayValueType valueType,
            @RequestParam("startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Date startDate,
            @RequestParam("endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Date endDate,
            @RequestParam(value = "limit", required = false) Integer limit) {
        try {
            return gatewayService.findGatewayDataByPeriodAndType(
                    gatewayId,
                    startDate,
                    endDate,
                    valueType,
                    Optional.ofNullable(limit)
            );
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error fetching gateway data", e);
        }
    }

    @GetMapping(value = "/manage-gateways/monitoring/{gatewayId}/history")
    @ResponseBody
    public Map<String, Object> getGatewayHistory(
            @PathVariable String gatewayId,
            @RequestParam("startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Date startDate,
            @RequestParam("endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Date endDate) {
        try {
            Map<GatewayValueType, LinkedHashMap<LocalDateTime, String>> dataGroupedByValueType =
                    gatewayService.findGatewayDataByPeriod(gatewayId, startDate, endDate);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("gatewayId", gatewayId);
            response.put("startDate", startDate);
            response.put("endDate", endDate);
            response.put("data", dataGroupedByValueType);
            return response;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error fetching gateway history", e);
        }
    }

    @GetMapping("/csrf-token")
    @ResponseBody
    public Map<String, String> csrfToken(CsrfToken token) {
        return Map.of(
                "parameterName", token.getParameterName(),
                "token", token.getToken()
        );
    }


    private void prepareModel(Model model) {
        model.addAttribute("frequencyPlans", FrequencyPlan.values());

        List<Gateway> gateways = gatewayService.getAllGateways();
        model.addAttribute("gateways", gateways);

        List<Building> buildings = buildingService.findAll();
        model.addAttribute("buildings", buildings);

        List<Protocol> protocols = protocolService.findAllAvailableForGateway();
        model.addAttribute("protocolsAvailable",protocols);


        List<Map<String, Object>> buildingFloors = buildings.stream()
                .map(b -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("id", b.getId());
                    m.put("name", b.getName());
                    m.put("floorsCount", b.getFloorsCount());
                    return m;
                })
                .collect(java.util.stream.Collectors.toList());
        model.addAttribute("buildingFloors", buildingFloors);
        model.addAttribute("locations", locationService.findAll());

        if (!model.containsAttribute(GATEWAY_ADD)) {
            model.addAttribute(GATEWAY_ADD, new Gateway());
        }

        if (!model.containsAttribute(GATEWAY_EDIT)) {
            model.addAttribute(GATEWAY_EDIT, null);
        }
    }

    private String redirectWithTimestamp() { return "redirect:/manage-gateways?_=" + System.currentTimeMillis(); }

}
