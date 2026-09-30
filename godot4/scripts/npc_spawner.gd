extends Node3D

@export var shop_path: NodePath = NodePath("../Shop")
@export var spawn_interval := 4.0
@export var max_npcs := 14
@export var max_initial_npcs := 4
@export var spawn_positions: Array[Vector3] = [
	Vector3(-20, 0, 15), Vector3(19, 0, 16), Vector3(-17, 0, -15),
	Vector3(20, 0, -13), Vector3(-3, 0, 22), Vector3(4, 0, -20)
]

const NPC_SCENE: PackedScene = preload("res://scenes/Npc.tscn")
const COLORS: Array[Color] = [
	Color("719ab2"), Color("bd7b85"), Color("a39b6b"),
	Color("8a79ae"), Color("75a285"), Color("b98968")
]

var _shop: Node3D
var _spawn_index := 0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
	_shop = get_node_or_null(shop_path) as Node3D
	if _shop == null:
		push_warning("NpcSpawner: Shop no encontrado en shop_path")
		return
	for i in range(mini(max_initial_npcs, max_npcs)):
		_spawn_one()
	_schedule_spawn()


func _on_spawn_timer() -> void:
	if _shop == null or spawn_positions.is_empty():
		return
	if get_child_count() < max_npcs:
		_spawn_one()
	_schedule_spawn()


func _schedule_spawn() -> void:
	get_tree().create_timer(maxf(0.2, spawn_interval)).timeout.connect(_on_spawn_timer)


func _spawn_one() -> void:
	if spawn_positions.is_empty():
		return
	var npc := NPC_SCENE.instantiate() as ShopNpc
	var candidate := spawn_positions[_spawn_index % spawn_positions.size()]
	_spawn_index += 1
	npc.position = candidate + Vector3(_rng.randf_range(-1.0, 1.0), 0.0, _rng.randf_range(-1.0, 1.0))
	npc.configure(_shop, COLORS[_spawn_index % COLORS.size()])
	add_child(npc)
	npc.call_deferred("start_visit")
