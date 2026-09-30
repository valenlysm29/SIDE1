extends CharacterBody3D
class_name ShopNpc

enum State { IDLE, PATROL, INTERACT, WALK_TO_SHOP, ENTER_SHOP, BROWSE, EXIT_SHOP, WANDER }

@export var walk_speed := 2.15
@export var browse_min_seconds := 3.0
@export var browse_max_seconds := 7.0
@export var wander_radius := 24.0

@onready var navigation_agent: NavigationAgent3D = $NavigationAgent3D
@onready var visual: Node3D = $Visual
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var animation_tree: AnimationTree = $AnimationTree
@onready var wait_timer: Timer = $WaitTimer

var shop: Node3D
var state := State.IDLE
var browse_stops := 0
var inside_shop := false
var home_position := Vector3.ZERO
var color := Color.WHITE
var _animation_playback: AnimationNodeStateMachinePlayback
var _rng := RandomNumberGenerator.new()
static var _color_materials: Dictionary = {}


func _ready() -> void:
	_rng.randomize()
	home_position = global_position
	# Waiting NPCs need neither physics ticks nor RVO avoidance updates.
	navigation_agent.avoidance_enabled = false
	navigation_agent.radius = 0.38
	navigation_agent.max_speed = walk_speed
	navigation_agent.velocity_computed.connect(_on_safe_velocity)
	wait_timer.timeout.connect(_on_wait_complete)
	_build_animations()
	if shop != null:
		_connect_door()
	set_state(State.IDLE)
	_begin_wait(0.01)


func configure(target_shop: Node3D, model_color: Color) -> void:
	shop = target_shop
	color = model_color
	if is_node_ready():
		_apply_color()
		_connect_door()


func start_visit() -> void:
	if shop == null:
		set_state(State.WANDER)
		return
	set_state(State.WALK_TO_SHOP)
	_set_destination(shop.get_exit_point())


func set_state(next_state: State) -> void:
	wait_timer.stop()
	state = next_state
	var is_waiting := state == State.IDLE or state == State.INTERACT
	navigation_agent.avoidance_enabled = not is_waiting
	set_physics_process(not is_waiting)
	if is_waiting:
		velocity = Vector3.ZERO
	match state:
		State.IDLE, State.INTERACT, State.BROWSE:
			_play_animation("interact" if state != State.IDLE else "idle")
		_:
			_play_animation("walk")


func _physics_process(delta: float) -> void:
	if navigation_agent.is_navigation_finished():
		_on_destination_reached()
		velocity = Vector3.ZERO
		return
	var next := navigation_agent.get_next_path_position()
	var direction := next - global_position
	direction.y = 0.0
	if direction.length_squared() < 0.0001:
		velocity = Vector3.ZERO
		return
	direction = direction.normalized()
	var desired_velocity := direction * walk_speed
	# NavigationAgent3D supplies a collision-safe velocity among moving NPCs.
	navigation_agent.set_velocity(desired_velocity)
	if desired_velocity.length_squared() > 0.01:
		visual.rotation.y = lerp_angle(visual.rotation.y, atan2(direction.x, direction.z), minf(1.0, delta * 8.0))


func _on_safe_velocity(safe_velocity: Vector3) -> void:
	if state == State.IDLE or state == State.INTERACT:
		return
	velocity = safe_velocity
	move_and_slide()


func _set_destination(point: Vector3) -> void:
	navigation_agent.target_position = point


func _on_destination_reached() -> void:
	match state:
		State.WALK_TO_SHOP:
			if shop == null or not shop.has_capacity():
				_begin_wander()
			else:
				set_state(State.ENTER_SHOP)
				_set_destination(shop.get_entry_point())
		State.ENTER_SHOP:
			if not inside_shop and not _enter_shop():
				_begin_wander()
				return
			browse_stops = _rng.randi_range(1, 3)
			_next_browse_stop()
		State.BROWSE:
			set_state(State.INTERACT)
			_begin_wait(_rng.randf_range(browse_min_seconds, browse_max_seconds))
		State.EXIT_SHOP:
			if inside_shop and shop != null:
				shop.exit_shop(self)
			inside_shop = false
			_begin_wander()
		State.WANDER, State.PATROL:
			set_state(State.IDLE)
			_begin_wait(_rng.randf_range(0.6, 2.3))
		_:
			_begin_wander()


func _on_wait_complete() -> void:
	match state:
		State.INTERACT:
			browse_stops -= 1
			if browse_stops > 0:
				_next_browse_stop()
			else:
				set_state(State.EXIT_SHOP)
				_set_destination(shop.get_exit_point())
		State.IDLE:
			_begin_wander()


func _begin_wait(seconds: float) -> void:
	wait_timer.start(maxf(0.01, seconds))


func _next_browse_stop() -> void:
	if shop == null:
		_begin_wander()
		return
	set_state(State.BROWSE)
	_set_destination(shop.get_browse_point())


func _begin_wander() -> void:
	set_state(State.WANDER)
	var angle := _rng.randf_range(-PI, PI)
	var radius := _rng.randf_range(5.0, wander_radius)
	var destination := home_position + Vector3(cos(angle) * radius, 0.0, sin(angle) * radius)
	if shop != null and destination.distance_to(shop.global_position) < 8.0:
		destination = home_position
	_set_destination(destination)


func _enter_shop() -> bool:
	if inside_shop:
		return true
	if shop == null or not shop.try_enter(self):
		return false
	inside_shop = true
	return true


func _connect_door() -> void:
	if shop == null or not is_instance_valid(shop):
		return
	var door := shop.get_node_or_null("DoorArea") as Area3D
	if door != null and not door.body_entered.is_connected(_on_door_body_entered):
		door.body_entered.connect(_on_door_body_entered)
	if door != null and not door.body_exited.is_connected(_on_door_body_exited):
		door.body_exited.connect(_on_door_body_exited)


func _on_door_body_entered(body: Node3D) -> void:
	if body != self or state != State.ENTER_SHOP or inside_shop:
		return
	if not _enter_shop():
		_begin_wander()


func _on_door_body_exited(body: Node3D) -> void:
	if body != self or state != State.EXIT_SHOP or not inside_shop:
		return
	shop.exit_shop(self)
	inside_shop = false


func _build_animations() -> void:
	var library := AnimationLibrary.new()
	for name in ["idle", "walk", "interact"]:
		var animation := Animation.new()
		animation.length = 1.0
		animation.loop_mode = Animation.LOOP_LINEAR
		var track := animation.add_track(Animation.TYPE_VALUE)
		animation.track_set_path(track, NodePath("Visual:position"))
		animation.track_insert_key(track, 0.0, Vector3.ZERO)
		animation.track_insert_key(track, 0.5, Vector3(0.0, 0.09 if name == "walk" else 0.025, 0.0))
		animation.track_insert_key(track, 1.0, Vector3.ZERO)
		library.add_animation(name, animation)
	animation_player.add_animation_library("", library)
	var machine := AnimationNodeStateMachine.new()
	for name in ["idle", "walk", "interact"]:
		var node := AnimationNodeAnimation.new()
		node.animation = name
		machine.add_node(name, node)
	for from_name in ["idle", "walk", "interact"]:
		for to_name in ["idle", "walk", "interact"]:
			if from_name == to_name:
				continue
			var transition := AnimationNodeStateMachineTransition.new()
			transition.xfade_time = 0.2
			machine.add_transition(from_name, to_name, transition)
	animation_tree.tree_root = machine
	animation_tree.active = true
	_animation_playback = animation_tree.get("parameters/playback") as AnimationNodeStateMachinePlayback
	_apply_color()


func _play_animation(name: String) -> void:
	if _animation_playback != null:
		_animation_playback.travel(name)


func _apply_color() -> void:
	var material: StandardMaterial3D = _color_materials.get(color)
	if material == null:
		material = StandardMaterial3D.new()
		material.albedo_color = color
		_color_materials[color] = material
	for mesh in [$Visual/Body, $Visual/Head]:
		mesh.material_override = material


func _exit_tree() -> void:
	if inside_shop and is_instance_valid(shop):
		shop.exit_shop(self)
