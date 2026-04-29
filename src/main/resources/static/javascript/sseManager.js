// sseManager.js
//
// Architecture des events SSE reçus du backend :
//   "snapshot" → données initiales chargées via HTTP TTN (Storage API)
//   "uplink"   → données live reçues via MQTT TTN
//   "keepalive"→ ping serveur pour maintenir la connexion
//
// Ce fichier ne sait pas (et n'a pas besoin de savoir) comment le backend
// récupère les données. Il expose juste un handler unique par subscriber
// qui reçoit aussi bien le snapshot initial que les uplinkss live.

(function () {
	// ===============================
	// GUARDS (singleton + browser)
	// ===============================
	if (typeof window === "undefined") return;
	if (window.SSEManager?.subscribeOccupancy) return;

	// ===============================
	// INTERNAL STATE
	// key -> { es:EventSource, listeners:Set<fn>, refCount:number }
	// ===============================
	const sources = new Map();

	// ===============================
	// SHARED HANDLER FACTORY
	// Crée un fan-out handler pour "snapshot" et "uplink"
	// Le handler reçoit { type: "snapshot"|"uplink", data: <parsed> }
	// ===============================
	function normalizeSsePayload(payload) {
		if (payload == null) return [];
		if (Array.isArray(payload)) {
			return payload.flatMap(normalizeSsePayload);
		}
		if (Array.isArray(payload.result)) {
			return payload.result.flatMap(normalizeSsePayload);
		}
		if (Array.isArray(payload.results)) {
			return payload.results.flatMap(normalizeSsePayload);
		}
		if (Array.isArray(payload.items)) {
			return payload.items.flatMap(normalizeSsePayload);
		}
		if (payload.result && typeof payload.result === "object") {
			return [payload.result];
		}
		return [payload];
	}

	function makeSseHandlers(entry, namespace) {
		function dispatch(type, e) {
			let payload;
			try {
				payload = JSON.parse(e.data);
			} catch (err) {
				console.warn(`[SSE][${namespace}] parse error (${type})`, err, e?.data);
				return;
			}

			const messages = normalizeSsePayload(payload);
			messages.forEach((msg) => {
				entry.listeners.forEach((fn) => {
					try {
						fn({ type, data: msg });
					} catch (err) {
						console.warn(`[SSE][${namespace}][listener] error`, err);
					}
				});
			});
		}

		return {
			onSnapshot: (e) => dispatch("snapshot", e),
			onUplink:   (e) => dispatch("uplink", e),
		};
	}

	// ===============================
	// OCCUPANCY
	// ===============================
	function keyFor(building) {
		return `occupancy:${building}`;
	}

	function getOrCreateOccupancy(building) {
		const key = keyFor(building);
		let entry = sources.get(key);

		if (!entry) {
			const url = `/api/dashboard/occupancy/stream?building=${encodeURIComponent(building)}`;
			const es = new EventSource(url);

			console.log("🧠 [SSEManager] create Occupancy EventSource", key);

			entry = { es, listeners: new Set(), refCount: 0 };

			const { onSnapshot, onUplink } = makeSseHandlers(entry, "occupancy");

			// snapshot = HTTP TTN (données initiales)
			es.addEventListener("snapshot", onSnapshot);
			// uplink   = MQTT TTN (live)
			es.addEventListener("uplink", onUplink);
			// keepalive = ping serveur
			es.addEventListener("keepalive", () => {});

			es.onopen  = () => console.log("✅ [SSE][occupancy] opened", building);
			// ⚠️ Ne PAS close ici : EventSource gère l'auto-retry
			es.onerror = (e) => console.warn("❌ [SSE][occupancy] error", building, e);

			sources.set(key, entry);
		}

		return entry;
	}

	function subscribeOccupancy(building, handler) {
		const entry = getOrCreateOccupancy(building);
		const key = keyFor(building);

		entry.listeners.add(handler);
		entry.refCount++;

		console.log(`➕ [SSE][occupancy] subscribe ${key} (refs=${entry.refCount})`);

		return () => {
			const current = sources.get(key);
			if (!current) return;

			current.listeners.delete(handler);
			current.refCount = Math.max(0, current.refCount - 1);

			console.log(`➖ [SSE][occupancy] unsubscribe ${key} (refs=${current.refCount})`);

			if (current.refCount === 0) {
				console.log("🔒 [SSE][occupancy] closing", building);
				current.es.close();
				sources.delete(key);
			}
		};
	}

	// ===============================
	// ENVIRONMENT
	// ===============================
	function envKey(building, deviceIds) {
		return `env:${building}:${deviceIds}`;
	}


	function getOrCreateEnvironment(building, deviceIds) {

		const key = envKey(building, deviceIds);
		let entry = sources.get(key);

		if (!entry) {

			const url = `/api/dashboard/live/stream?building=${building}&deviceIds=${deviceIds}`;
			const es = new EventSource(url);

			console.log("🌍 [SSE] create ENV stream:", url);

			entry = {
				es,
				listeners: new Set(),
				refCount: 0
			};

			function handle(e) {
				const raw = JSON.parse(e.data);
				const msg = raw?.result ?? raw;

				entry.listeners.forEach(fn => fn(msg));
			}

			es.addEventListener("snapshot", handle);
			es.addEventListener("uplink", handle);

			es.onerror = (e) => console.warn("❌ [SSE][env] error", e);
			es.onopen = () => console.log("✅ [SSE][env] opened");

			sources.set(key, entry);
		}

		return entry;
	}

	function subscribeEnvironment(building, deviceIds, callback) {
		const entry = getOrCreateEnvironment(building, deviceIds);

		entry.listeners.add(callback);
		entry.refCount++;

		return () => {
			entry.listeners.delete(callback);
			entry.refCount--;

			if (entry.refCount <= 0) {
				entry.es.close();
				sources.delete(envKey(building, deviceIds));
				console.log("❌ [SSE] closed ENV stream");
			}
		};
	};

	// ===============================
	// EXPORT
	// ===============================
	window.SSEManager = {
		subscribeOccupancy,
		subscribeEnvironment,
	};
})();
