package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Brand;
import com.amaris.sensorprocessor.repository.BrandRepository;
import org.mozilla.javascript.Context;
import org.mozilla.javascript.Scriptable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class BrandService {

    private final BrandRepository brandRepository;

    public BrandService(BrandRepository brandRepository) {
        this.brandRepository = brandRepository;
    }

    public List<Brand> findAll() {
        return brandRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
    }

    public Optional<Brand> findById(Integer id) {
        return brandRepository.findById(id);
    }

    public Brand createByName(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Brand name is required");
        }
        String cleaned = name.trim();
        Brand brand = new Brand();
        brand.setName(cleaned);
        try {
            return brandRepository.save(brand);
        } catch (DataIntegrityViolationException e) {
            throw new IllegalStateException("Brand already exists: " + cleaned);
        }
    }

    public void deleteById(Integer id) {
        brandRepository.deleteById(id);
    }

    public void updateDecoder(Integer id, String decoder) {
        Brand brand = brandRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Brand not found: " + id));
        brand.setPayloadDecoder(decoder);
        brandRepository.save(brand);
    }

    public String getDecoder(Integer id) {
        return brandRepository.findById(id)
                .map(Brand::getPayloadDecoder)
                .orElse("");
    }

    public String testDecoder(String decoderJs, String hexPayload, int fPort) {
        String bytesJs = hexToJsArray(hexPayload);

        String script = decoderJs + "\n"
                + "(function() {\n"
                + "  try {\n"
                + "    var __r = decodeUplink({ bytes: " + bytesJs + ", fPort: " + fPort + " });\n"
                + "    return JSON.stringify(__r);\n"
                + "  } catch(e) {\n"
                + "    return JSON.stringify({ error: e.message });\n"
                + "  }\n"
                + "})();";

        Context cx = Context.enter();
        try {
            cx.setOptimizationLevel(-1); // Requis sur Java 17 (pas de bytecode generation)
            cx.setLanguageVersion(Context.VERSION_ES6);
            Scriptable scope = cx.initSafeStandardObjects();
            Object result = cx.evaluateString(scope, script, "decoder", 1, null);
            return Context.toString(result);
        } finally {
            Context.exit(); // Toujours libérer le contexte Rhino
        }
    }

    private String hexToJsArray(String hex) {
        if (hex == null || hex.isBlank()) return "[]";
        hex = hex.replaceAll("\\s+", "");
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < hex.length(); i += 2) {
            if (i > 0) sb.append(",");
            sb.append(Integer.parseInt(hex.substring(i, i + 2), 16));
        }
        return sb.append("]").toString();
    }
}
