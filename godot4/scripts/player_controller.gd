extends CharacterBody3D
class_name WorldPlayer

## Paseo básico: WASD/flechas, Mayús para correr, espacio para saltar.
## Tab cambia a la cámara panorámica y arrastrar botón derecho gira la cámara.
@export var walk_speed: float = 4.5
@export var run_speed: float = 7.0
@export var jump_speed: float = 5.0
@export var map_limit: float = 87.5

@onready var camera_pivot: Node3D = $CameraPivot
@onready var follow_camera: Camera3D = $CameraPivot/SpringArm3D/Camera3D
@onready var visual: Node3D = $Visual

var _gravity: float = 9.8
var _overview: Camera3D


func _ready() -> void:
	add_to_group("player")
	floor_snap_length = 0.3
	floor_max_angle = deg_to_rad(45.0)
	safe_margin = 0.01
	up_direction = Vector3.UP
	_gravity = float(ProjectSettings.get_setting("physics/3d/default_gravity", 9.8))
	_overview = get_parent().get_node_or_null("PlayerCamera") as Camera3D
	($CameraPivot/SpringArm3D as SpringArm3D).add_excluded_object(get_rid())
	follow_camera.make_current()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_TAB:
		if _overview != null and not _overview.current:
			_overview.make_current()
		else:
			follow_camera.make_current()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		camera_pivot.rotation.y -= event.relative.x * 0.008


func _physics_process(delta: float) -> void:
	var axes := Vector2(
		float(Input.is_physical_key_pressed(KEY_D) or Input.is_action_pressed("ui_right")) - float(Input.is_physical_key_pressed(KEY_A) or Input.is_action_pressed("ui_left")),
		float(Input.is_physical_key_pressed(KEY_S) or Input.is_action_pressed("ui_down")) - float(Input.is_physical_key_pressed(KEY_W) or Input.is_action_pressed("ui_up"))
	)
	var direction := camera_pivot.global_basis * Vector3(axes.x, 0.0, axes.y)
	direction.y = 0.0
	direction = direction.normalized()
	var speed := run_speed if Input.is_physical_key_pressed(KEY_SHIFT) else walk_speed
	velocity.x = direction.x * speed
	velocity.z = direction.z * speed
	if not is_on_floor():
		velocity.y -= _gravity * delta
	elif Input.is_physical_key_pressed(KEY_SPACE):
		velocity.y = jump_speed
	else:
		velocity.y = 0.0
	move_and_slide()
	# El borde señalizado del barrio delimita la superficie disponible.
	global_position.x = clampf(global_position.x, -map_limit, map_limit)
	global_position.z = clampf(global_position.z, -map_limit, map_limit)
	if direction.length_squared() > 0.01:
		visual.rotation.y = lerp_angle(visual.rotation.y, atan2(direction.x, direction.z), minf(delta * 10.0, 1.0))
