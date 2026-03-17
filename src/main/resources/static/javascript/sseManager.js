// sseManager.js
(function () {
	// ===============================
	// GUARDS (singleton + browser)
	// ===============================
	if (typeof window === "undefined") return;
	if (window.SSEManager?.subscribeOccupancy) return;

	// ===============================
	// INTERNAL STATE
	// ===============================
	// key -> { es:EventSource, listeners:Set<fn>, refCount:number }
	const sources = new Map();

	function keyFor(building) {
		return `occupancy:${building}`;
	}

	// ===============================
	// FACTORY
	// ===============================
	function getOrCreateOccupancy(building) {
		const key = keyFor(building);
		let entry = sources.get(key);

		if (!entry) {
			const url = `/api/dashboard/occupancy/stream?building=${encodeURIComponent(building)}`;
			const es = new EventSource(url);

			console.log("🧠 [SSEManager] create EventSource", key);

			entry = {
				es,
				listeners: new Set(),
				refCount: 0,
			};

			// -------- uplink fan-out --------
			es.addEventListener("uplink", (e) => {
				let msg;
				try {
					const raw = JSON.parse(e.data);
					msg = raw?.result ?? raw;
				} catch (err) {
					console.warn("[SSE][occupancy] parse error", err, e?.data);
					return;
				}

				entry.listeners.forEach((fn) => {
					try {
						fn(msg);
					} catch (err) {
						console.warn("[SSE][occupancy][listener] error", err);
					}
				});
			});

			// -------- keepalive --------
			es.addEventListener("keepalive", () => {});

			// -------- lifecycle --------
			es.onopen = () =>
				console.log("✅ [SSE][occupancy] opened", building);

			// ⚠️ Ne PAS close ici : EventSource gère l’auto-retry
			es.onerror = (e) =>
				console.warn("❌ [SSE][occupancy] error", building, e);

			sources.set(key, entry);
		}

		return entry;
	}

	// ===============================
	// PUBLIC API
	// ===============================
	function subscribeOccupancy(building, handler) {
		const entry = getOrCreateOccupancy(building);
		const key = keyFor(building);

		entry.listeners.add(handler);
		entry.refCount++;

		console.log(
			`➕ [SSE][occupancy] subscribe ${key} (refs=${entry.refCount})`
		);

		// -------- unsubscribe --------
		return () => {
			const current = sources.get(key);
			if (!current) return;

			current.listeners.delete(handler);
			current.refCount = Math.max(0, current.refCount - 1);

			console.log(
				`➖ [SSE][occupancy] unsubscribe ${key} (refs=${current.refCount})`
			);

			if (current.refCount === 0) {
				console.log("🔒 [SSE][occupancy] closing", building);
				current.es.close();
				sources.delete(key);
			}
		};
	}

	const BUILDING_ENV_CONFIG = {
		23: {
			deviceIds: ["desk-01-02"],
			metrics: ["temperature", "humidity", "co2"] // pas de sound
		},
		21: {
			deviceIds: ["co2-03-02", "son-03-03"],
			metrics: ["temperature", "humidity", "co2", "sound"]
		}
	};


	function getEnvironmentDevices(building) {
		const cfg = BUILDING_ENV_CONFIG[building];
		if (!cfg) return [];
		return cfg.deviceIds;
	}


	function keyForEnvironment(building) {
		return `environment:${building}`;
	}


	function getOrCreateEnvironment(building) {

		const key = keyForEnvironment(building);
		let entry = sources.get(key);

		if (!entry) {
			const deviceIds = getEnvironmentDevices(building);
			const url =
				`/api/dashboard/live/stream` +
				`?building=${building}` +
				`&deviceIds=${deviceIds.join(",")}`;

			const es = new EventSource(url);

			console.log("🌡️ [SSEManager] create Environment EventSource", url);

			entry = {
				es,
				listeners: new Set(),
				refCount: 0
			};

			es.addEventListener("uplink", (e) => {

				let msg;

				try {
					const raw = JSON.parse(e.data);
					msg = raw?.result ?? raw;
				} catch (err) {
					console.warn("[SSE][environment] parse error", err);
					return;
				}

				entry.listeners.forEach(fn => {
					try {
						fn(msg);
					} catch (err) {
						console.warn("[SSE][environment][listener] error", err);
					}
				});

			});

			es.addEventListener("keepalive", () => {});

			es.onopen = () =>
				console.log("✅ [SSE][environment] opened", building);

			es.onerror = (e) =>
				console.warn("❌ [SSE][environment] error", building, e);

			sources.set(key, entry);
		}

		return entry;
	}

	function subscribeEnvironment(building, handler) {

		const entry = getOrCreateEnvironment(building);
		const key = keyForEnvironment(building);

		entry.listeners.add(handler);
		entry.refCount++;

		console.log(`➕ [SSE][environment] subscribe ${key} (refs=${entry.refCount})`);

		return () => {

			const current = sources.get(key);
			if (!current) return;

			current.listeners.delete(handler);
			current.refCount = Math.max(0, current.refCount - 1);

			console.log(`➖ [SSE][environment] unsubscribe ${key} (refs=${current.refCount})`);

			if (current.refCount === 0) {

				console.log("🔒 [SSE][environment] closing", building);

				current.es.close();
				sources.delete(key);
			}

		};
	}


	// ===============================
	// EXPORT
	// ===============================
	window.SSEManager = {
		subscribeOccupancy,
		subscribeEnvironment
	};
})();
