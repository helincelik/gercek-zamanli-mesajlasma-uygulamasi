from flask_jwt_extended import get_jwt_identity
from flask import Flask, render_template, request, jsonify, redirect
from flask_socketio import SocketIO, emit
from flask_pymongo import PyMongo
from flask_jwt_extended import JWTManager, create_access_token, decode_token
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
from uuid import uuid4
from datetime import timedelta, datetime
import logging
from flask_jwt_extended import jwt_required
from bson import ObjectId

app = Flask(__name__)
app.config["MONGO_URI"] = "mongodb://localhost:27017/chat"
app.config["JWT_SECRET_KEY"] = "super-secret"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=1)

mongo = PyMongo(app)
jwt = JWTManager(app)
CORS(app)
socketio = SocketIO(app, async_mode="threading", cors_allowed_origins="*")

connected_users = {}

@app.route('/')
def index():
    token = request.args.get('token')
    if not token:
        return render_template('index.html', messages=[], current_user='')
    try:
        decoded = decode_token(token)
        current_user = mongo.db.users.find_one({"uuid": decoded["sub"]})
        messages = mongo.db.messages.find()
        return render_template("index.html", messages=messages, current_user=current_user["username"])
    except:
        return redirect('/')
    
    
@app.route('/login', methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return redirect('/')
    try:
        data = request.get_json()
        username = data.get("username", "").lower().strip()
        password = data.get("password", "").strip()

        user = mongo.db.users.find_one({"username": username})
        if not user:
            return jsonify({"msg": "Kullanıcı bulunamadı"}), 404

        if check_password_hash(user["password_hash"], password):
            access_token = create_access_token(identity=user["uuid"])
            return jsonify(access_token=access_token, uuid=user["uuid"]), 200
        else:
            return jsonify({"msg": "Şifre hatalı"}), 401

    except Exception as e:
        print("Login hatası:", str(e))
        return jsonify({"msg": "Sunucu hatası"}), 500



@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get("username", "").lower().strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"msg": "Kullanıcı adı ve şifre gerekli."}), 400

    if mongo.db.users.find_one({"username": username}):
        return jsonify({"msg": "Bu kullanıcı adı zaten alınmış."}), 409

    new_user = {
        "username": username,
        "password_hash": generate_password_hash(password),
        "uuid": str(uuid4())
    }
    mongo.db.users.insert_one(new_user)
    return jsonify({"msg": "Kayıt başarılı!"}), 201



@app.route('/send_message', methods=['POST'])
@jwt_required()
def send_message():
    try:
        user_uuid = get_jwt_identity()
        user = mongo.db.users.find_one({"uuid": user_uuid})
        if not user:
            return jsonify({"msg": "Kullanıcı bulunamadı"}), 404

        message_text = request.json.get("message", "").strip()
        if not message_text:
            return jsonify({"msg": "Boş mesaj gönderilemez"}), 400

        new_msg = {
            "from": user_uuid,
            "username": user["username"],
            "message": message_text,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "sent"
        }

        # Veritabanına ekle
        mongo.db.messages.insert_one(new_msg)

        # _id alanını içermediğinden emin ol
        response_msg = {
            "from": new_msg["from"],
            "username": new_msg["username"],
            "message": new_msg["message"],
            "timestamp": new_msg["timestamp"],
            "status": new_msg["status"]
        }

        socketio.emit('receive_message', response_msg, broadcast=True)

        return jsonify(response_msg), 200
    except Exception as e:
        print("❌ Mesaj gönderme hatası:", str(e))
        return jsonify({"msg": "Mesaj gönderilemedi"}), 500




@socketio.on('connect')
def handle_connect():
    print("📡 Bağlantı isteği alındı.")

@socketio.on('register_uuid')
def handle_register_uuid(data):
    user_uuid = data.get('uuid')
    sid = request.sid
    if user_uuid:
        connected_users[user_uuid] = sid
        print(f"✅ Bağlandı → UUID: {user_uuid} → SID: {sid}")
        update_online_users()
def update_online_users():
    online_users = []
    for uuid in connected_users:
        user = mongo.db.users.find_one({"uuid": uuid})
        if user:
            online_users.append({
                "uuid": uuid,
                "username": user["username"]
            })
    socketio.emit("online_users", online_users)



@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    for uuid, saved_sid in list(connected_users.items()):
        if saved_sid == sid:
            print(f"🔌 Bağlantı kesildi → UUID: {uuid} → SID: {sid}")
            del connected_users[uuid]
            break
    update_online_users()


@socketio.on('get_all_users')
def handle_get_all_users():
    all_users = []
    for user in mongo.db.users.find():
        all_users.append({"uuid": user["uuid"], "username": user["username"]})
    emit("online_users", all_users)

@socketio.on('send_message')
def handle_send_message(data):
    token = data.get('token')
    if not token:
        emit('message_auth_error', {'msg': 'Token eksik'})
        return

    try:
        decoded = decode_token(token)
        user_uuid = decoded['sub']
        user = mongo.db.users.find_one({"uuid": user_uuid})
        if not user:
            emit('message_auth_error', {'msg': 'Geçersiz kullanıcı'})
            return

        message_text = data.get("text", "").strip()
        if not message_text:
            print("❌ Boş mesaj gönderimi engellendi.")
            return

        message = {
            "from": user_uuid,
            "username": user["username"],
            "message": message_text
        }
        emit('receive_message', message, broadcast=True)

    except Exception as e:
        print("Mesaj gönderim hatası:", str(e))
        emit('message_auth_error', {'msg': 'Token çözümleme hatası'})

@socketio.on('send_private_message')
def handle_private_message(data):
    token = data.get('token')
    if not token:
        emit('message_auth_error', {'msg': 'Token eksik'})
        return

    try:
        decoded = decode_token(token)
        from_uuid = decoded['sub']
        to_uuid = data.get('to')
        message = data.get('message')

        if to_uuid in connected_users:
            emit('receive_private_message', {
                "from": mongo.db.users.find_one({"uuid": from_uuid})["username"],
                "message": message
            }, room=connected_users[to_uuid])
        else:
            emit('message_auth_error', {'msg': 'Kullanıcı çevrimdışı'})
    except Exception as e:
        print("Özel mesaj hatası:", str(e))
        emit('message_auth_error', {'msg': 'Token çözümleme hatası'})

@socketio.on("incoming_call")
def handle_incoming_call(data):
    to_uuid = data.get("to")
    from_uuid = data.get("from")
    username = data.get("username")
    if to_uuid in connected_users:
        emit("incoming_call", {
            "from": from_uuid,
            "username": username
        }, room=connected_users[to_uuid])

@socketio.on("call_accepted")
def handle_call_accepted(data):
    to_uuid = data.get("to")
    if to_uuid in connected_users:
        emit("call_accepted", {}, room=connected_users[to_uuid])
@socketio.on("end_call")
def handle_end_call(data):
    to_uuid = data.get("to")
    if to_uuid in connected_users:
        emit("call_ended", {}, room=connected_users[to_uuid])


@socketio.on("call_rejected")
def handle_call_rejected(data):
    to_uuid = data.get("to")
    if to_uuid in connected_users:
        emit("call_rejected", {}, room=connected_users[to_uuid])


def update_online_users():
    users = []
    for uuid_key in list(connected_users):
        user = mongo.db.users.find_one({"uuid": uuid_key})
        if user:
            users.append({
                "uuid": uuid_key,
                "username": user["username"]
            })
    socketio.emit("online_users", users)

if __name__ == '__main__':
    print("🟢 Sunucu başlatılıyor: https://localhost:5000")
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    socketio.run(app, host='localhost', port=5000, ssl_context=('cert.pem', 'key.pem'))

@socketio.on("webrtc_offer")
def handle_webrtc_offer(data):
    to_uuid = data.get("to")
    offer = data.get("offer")
    from_sid = request.sid
    from_uuid = next((uuid for uuid, sid in connected_users.items() if sid == from_sid), None)
    if to_uuid in connected_users:
        emit("webrtc_offer", {"from": from_uuid, "offer": offer}, room=connected_users[to_uuid])

@socketio.on("webrtc_answer")
def handle_webrtc_answer(data):
    to_uuid = data.get("to")
    answer = data.get("answer")
    from_sid = request.sid
    from_uuid = next((uuid for uuid, sid in connected_users.items() if sid == from_sid), None)
    if to_uuid in connected_users:
        emit("webrtc_answer", {"from": from_uuid, "answer": answer}, room=connected_users[to_uuid])

@socketio.on("webrtc_ice_candidate")
def handle_webrtc_ice(data):
    to_uuid = data.get("to")
    candidate = data.get("candidate")
    if to_uuid in connected_users:
        emit("webrtc_ice_candidate", {"candidate": candidate}, room=connected_users[to_uuid])


@socketio.on("message_delivered")
def handle_message_delivered(data):
    from_uuid = data.get("from")
    message_text = data.get("message")

    result = mongo.db.messages.find_one_and_update(
        {"from": from_uuid, "message": message_text},
        {"$set": {"status": "delivered"}}
    )

    if result:
        # Gönderene status update bildir
        to_sid = connected_users.get(from_uuid)
        if to_sid:
            emit("message_status_update", {
                "message": message_text,
                "status": "delivered"
            }, room=to_sid)

@socketio.on("message_read")
def handle_message_read(data):
    from_uuid = data.get("from")
    message_text = data.get("message")

    result = mongo.db.messages.find_one_and_update(
        {"from": from_uuid, "message": message_text},
        {"$set": {"status": "read"}}
    )

    if result:
        to_sid = connected_users.get(from_uuid)
        if to_sid:
            emit("message_status_update", {
                "message": message_text,
                "status": "read"
            }, room=to_sid)


#C:\Users\Helin\Desktop\chat\app.py

#cd Desktop\chat
#python app.py