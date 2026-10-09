extends SceneTree
## Regresión del paso físico: callbacks RVO, cambios LOD y gravedad durante IDLE.


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var world: Node3D = (load("res://scenes/Main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(world)
	var manager: NPCManager = world.get_node("NpcSpawner") as NPCManager
	var npcs: Array[ShopNpc] = manager.get_population()
	# Arranque adverso: todos los pies exactamente a cota cero antes del primer tick.
	for npc: ShopNpc in npcs:
		npc.position.y = 0.0
	for frame in range(24):
		await physics_frame
	var first: ShopNpc = npcs[0]
	first.set_state(ShopNpc.State.PATROL)
	first._set_destination(Vector3(0, 0, 14))
	first.set_full_detail(true)
	var before: Vector3 = first.global_position
	first._on_safe_velocity(Vector3(2.0, 0.0, 0.0))
	if first.global_position != before:
		_fail("El callback RVO movió el cuerpo fuera del paso físico")
		return
	first.set_full_detail(false)
	first._on_safe_velocity(Vector3(2.0, 0.0, 0.0))
	if first.global_position != before or first._has_safe_velocity:
		_fail("Un callback pendiente siguió activo después del cambio de LOD")
		return
	var minimum_y: float = 100.0
	for frame in range(1200):
		# Cien cambios de detalle durante el movimiento, sin recolocar cuerpos.
		if frame < 100:
			for npc: ShopNpc in npcs:
				npc.set_full_detail(frame % 2 == 0)
		await physics_frame
		for npc: ShopNpc in npcs:
			minimum_y = minf(minimum_y, npc.global_position.y)
			if npc.global_position.y < -0.05:
				_fail("Caída con alternancia LOD: %s position=%s state=%d" % [npc.name, npc.global_position, npc.state])
				return
	# IDLE también debe apoyar un cuerpo que empieza unos centímetros elevado.
	first.set_state(ShopNpc.State.IDLE)
	first.global_position = Vector3(-10, 0.30, 10)
	first.velocity = Vector3.ZERO
	for frame in range(90):
		await physics_frame
	if first.global_position.y > 0.04 or first.global_position.y < -0.05 or not first.is_on_floor():
		_fail("IDLE suspendió la gravedad o perdió el suelo: position=%s floor=%s" % [first.global_position, first.is_on_floor()])
		return
	print("NPC_PHYSICS_OK: 24 arranques en y=0, callback sin movimiento, 100 cambios LOD y gravedad IDLE; minimum_y=%.5f" % minimum_y)
	quit(0)


func _fail(message: String) -> void:
	push_error("NPC_PHYSICS_FAILED: " + message)
	quit(1)
