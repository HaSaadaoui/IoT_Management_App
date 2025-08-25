package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.constant.Constants;
import com.amaris.sensorprocessor.constant.FrequencyPlan;
import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.service.GatewayLorawanService;
import com.amaris.sensorprocessor.service.GatewayService;
import com.amaris.sensorprocessor.service.InputValidationService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindingResult;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Controller
public class GatewayController {

    private final GatewayService gatewayService;
    private final InputValidationService inputValidationService;
    private final GatewayLorawanService gatewayLorawanService;

    private static final String ERROR_ADD = "errorAdd";
    private static final String GATEWAY_ADD = "gatewayAdd";
    private static final String ERROR_EDIT = "errorEdit";
    private static final String GATEWAY_EDIT = "gatewayEdit";
    private static final String ERROR_DELETE = "errorDelete";

    @Autowired
    public GatewayController(GatewayService gatewayService,
                             InputValidationService inputValidationService,
                             GatewayLorawanService gatewayLorawanService) {
        this.gatewayService = gatewayService;
        this.inputValidationService = inputValidationService;
        this.gatewayLorawanService = gatewayLorawanService;
    }

    @GetMapping("/manage-gateways")
    public String manageGateways(Model model) {
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
    public String editGateway(@PathVariable String gatewayId, Model model) {
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
    public String handleEditGet(@RequestParam(required = false) String gatewayId, Model model) {
        if (gatewayId == null) {
            return redirectWithTimestamp();
        }
        return editGateway(gatewayId, model);
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
    public String monitoringView(@PathVariable("id") String id, @RequestParam("ip") String ip, Model model) {
        model.addAttribute(Constants.BINDING_GATEWAY_ID, id);
        model.addAttribute("ipAddress", ip);
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
    @GetMapping("/manage-gateways/monitoring/{id}/stream")
    public SseEmitter streamMonitoringData(@PathVariable("id") String id, @RequestParam("ip") String ip, HttpSession httpSession) {
        SseEmitter emitter = new SseEmitter(3600000L);
        String sessionKey = id + "-" + httpSession.getId();

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
        if (!model.containsAttribute(GATEWAY_ADD)) {
            model.addAttribute(GATEWAY_ADD, new Gateway());
        }
    }

    private String redirectWithTimestamp() { return "redirect:/manage-gateways?_=" + System.currentTimeMillis(); }

}
