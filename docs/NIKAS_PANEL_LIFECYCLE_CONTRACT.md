# NikaS Panel Lifecycle Contract v1.0

## Scope

This contract applies to every NikaS route owned by an integration or generated
panel manifest. It defines panel availability; it does not change device protocols,
credentials, commands or telemetry semantics.

## Normative rules

### LIFECYCLE-01 — Route ownership is configuration state

An installed and configured panel owner controls whether its route and sidebar entry
exist. Physical-device reachability, vendor-cloud availability and the presence of a
fresh telemetry sample do not control route existence.

### LIFECYCLE-02 — Register before fallible device I/O

Register the owned static path, websocket/bootstrap surface and panel route before
calling device, RCI, Tuya, cloud or coordinator operations that may raise
`ConfigEntryNotReady`, `ConfigEntryAuthFailed` or `UpdateFailed`.

An integration-wide `async_setup` registration is conforming when the route is not
specific to one config entry. An entry-owned route must publish the minimal runtime
state needed by bootstrap before registration.

### LIFECYCLE-03 — Initial failure is fail-closed content

No sample yet, timeout, offline, authentication failure, `unknown` and
`unavailable` render as explicit non-healthy states inside the mounted panel. They
must not remove the route, hide the sidebar entry or display a healthy default.

### LIFECYCLE-04 — Refresh cannot own panel lifetime

`async_config_entry_first_refresh()` or any equivalent successful read must not be a
precondition for panel registration. A required config-entry retry may block entity
setup, but it must leave the already-owned panel route intact.

### LIFECYCLE-05 — Recovery uses the normal backend lifecycle

After an initial failure, the coordinator or Home Assistant config-entry retry
mechanism continues attempts without requiring a browser reload or manual panel
re-registration. A later successful sample patches the existing mounted content.

### LIFECYCLE-06 — Generated panels follow manifests

For generated panels, enabled manifest/configuration state controls existence.
Current entity availability controls rendered state only. Missing bindings fail
closed inside the panel and never silently suppress the route.

### LIFECYCLE-07 — Ownership and unload remain exact

Registration must not replace a route owned by another integration. Unload removes a
route only when the unloading owner registered it, and one config entry must not
remove a shared route still used by another entry.

### LIFECYCLE-08 — Frontend bootstrap tolerates zero telemetry

The production frontend must mount its Header, navigation and unavailable/no-data
surface when bootstrap contains no device, entity or current sample. Retry and
recovery must not rebuild the application shell.

## Required regression cases

| Case | Required evidence |
|---|---|
| `registration_before_refresh` | Static or unit test proves route registration precedes fallible first refresh/device I/O. |
| `initial_failure_preserves_route` | Failed first read leaves the owned route/sidebar entry registered. |
| `offline_bootstrap` | Empty or unavailable bootstrap mounts explicit non-healthy content. |
| `retry_recovery` | A later accepted sample updates the mounted panel through normal retry/coordinator flow. |
| `route_collision` | An existing foreign owner is preserved. |
| `unload_ownership` | Only the registering owner removes the route. |
| `generated_manifest_ownership` | Generated route existence follows enabled configuration, not entity state. |

Repository CI should cover every applicable case. Hardware evidence is required only
when validating a physical protocol or command; lifecycle ordering itself must be
testable without live hardware.
