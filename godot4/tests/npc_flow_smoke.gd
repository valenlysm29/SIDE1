extends SceneTree


func _initialize() -> void:
	print("NPC_TEST_STARTED")
	call_deferred("_run")


func _run() -> void:
	var main: Node3D = (load("res://scenes/Main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	await physics_frame
	var spawner: Node3D = main.get_node("NpcSpawner")
	var shop: Node3D = main.get_node("Shop")
	assert(spawner.get_child_count() > 0, "El spawner no creó NPCs")
	var first: ShopNpc = spawner.get_child(0)
	var origin := first.global_position
	var saw_inside := false
	var saw_exit := false
	for frame in range(3600):
		await physics_frame
		if first.inside_shop:
			saw_inside = true
		elif saw_inside:
			saw_exit = true
		assert(shop._occupants.size() <= shop.max_capacity, "Aforo excedido")
	assert(first.global_position.distance_to(origin) > 3.0, "El NPC no caminó")
	assert(saw_inside, "El NPC no entró a la tienda")
	assert(saw_exit, "El NPC no salió de la tienda")
	print("NPC_FLOW_OK")
	quit()
