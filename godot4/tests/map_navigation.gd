extends SceneTree


func _initialize() -> void:
	call_deferred("_check_routes")


func _check_routes() -> void:
	var scene := load("res://scenes/Main.tscn").instantiate() as Node3D
	root.add_child(scene)
	# El servidor de navegación integra la región de forma diferida.
	for i in range(24):
		await physics_frame
	var map_rid := scene.get_world_3d().navigation_map
	if NavigationServer3D.map_get_regions(map_rid).size() != 1:
		push_error("NavigationRegion3D no se registró en el mapa")
		quit(1)
		return
	var routes := [
		[Vector3(-20, 0, 15), Vector3(0, 0, 3.8)],
		[Vector3(20, 0, -13), Vector3(0, 0, 3.8)],
		[Vector3(-74, 0, -74), Vector3(74, 0, 74)]
	]
	for route in routes:
		var path := NavigationServer3D.map_get_path(map_rid, route[0], route[1], true)
		if path.size() < 2 or path[-1].distance_to(route[1]) > 1.0:
			push_error("Ruta de navegación interrumpida: %s -> %s" % [route[0], route[1]])
			quit(1)
			return
	print("NavMesh: tres rutas exteriores e interior de tienda conectadas")
	quit(0)
