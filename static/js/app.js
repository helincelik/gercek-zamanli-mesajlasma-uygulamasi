window.addEventListener('DOMContentLoaded', () => {
  const socket = io();
const endCallBtn = document.getElementById("end-call-btn");
const callingStatus = document.getElementById("calling-status");
const callingText = document.getElementById("calling-text");


  let logoutTimer;
  const INACTIVITY_LIMIT = 5 * 60 * 1000;

  function resetInactivityTimer() {
    clearTimeout(logoutTimer);
    logoutTimer = setTimeout(() => {
      alert("Güvenlik nedeniyle oturumunuz sonlandırıldı.");
      localStorage.clear();
      window.location.reload();
    }, INACTIVITY_LIMIT);
  }

  document.addEventListener("mousemove", resetInactivityTimer);
  document.addEventListener("keydown", resetInactivityTimer);
  document.addEventListener("click", resetInactivityTimer);
  document.addEventListener("scroll", resetInactivityTimer);
  resetInactivityTimer();
  endCallBtn.addEventListener("click", () => {
  window.endCall();
  window.endCall = function () {
  cleanUpCall();
  socket.emit("end_call", { to: currentCaller || localStorage.getItem("uuid") });
};

function cleanUpCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  endCallBtn.style.display = "none";
  callingStatus.style.display = "none";
  document.getElementById("remoteAudio").srcObject = null;
}

  
});


  socket.on('connect', () => {
    const uuid = localStorage.getItem('uuid');
    if (uuid) {
      socket.emit('register_uuid', { uuid });
    }
    socket.emit('get_all_users');
  });

  socket.on('receive_private_message', (data) => {
    alert(`📩 Özel mesaj geldi: ${data.from} → ${data.message}`);
  });

  socket.on('receive_message', (message) => {
    renderMessage(message);

    socket.emit("message_delivered", {
      from: message.from,
      message: message.message
    });

    if (document.hasFocus()) {
      socket.emit("message_read", {
        from: message.from,
        message: message.message
      });
    }
  });

  socket.on("message_status_update", (data) => {
    const messages = document.querySelectorAll(".message");
    messages.forEach(msgEl => {
      if (msgEl.dataset.messageText === data.message) {
        const statusSpan = msgEl.querySelector(".message-status");
        if (statusSpan) {
          statusSpan.textContent = `✓ ${data.status}`;
        }
      }
    });
  });

  socket.on('online_users', (users) => {
    renderUserList(users);
  });

  document.getElementById("login-btn")?.addEventListener("click", async () => {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!username || !password) {
      alert("Kullanıcı adı ve şifre gerekli.");
      return;
    }

    try {
      const response = await fetch("https://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("uuid", data.uuid);
        localStorage.setItem("username", username);
        localStorage.setItem("jwt", data.access_token);
        window.location.reload();
      } else {
        alert(data.msg || "Giriş başarısız.");
      }
    } catch (err) {
      alert("Sunucuya bağlanılamadı.");
    }
  });

  document.getElementById("register-btn")?.addEventListener("click", async () => {
  const username = document.getElementById("register-username").value.trim();
  const password = document.getElementById("register-password").value.trim();

  if (!username || !password) {
    alert("Kullanıcı adı ve şifre gerekli.");
    return;
  }

  try {
    const response = await fetch("https://localhost:5000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      alert("✅ Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
    } else {
      alert(data.msg || "Kayıt başarısız.");
    }
  } catch (err) {
    alert("Sunucuya bağlanılamadı.");
  }
});


  document.getElementById("logout-btn")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.reload();
  });

  document.getElementById("send-btn")?.addEventListener("click", async () => {
    const messageInput = document.getElementById("message-input");
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    const token = localStorage.getItem("jwt");

    try {
      const response = await fetch("https://localhost:5000/send_message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ message: messageText })
      });

      const data = await response.json();

      if (response.ok) {
        messageInput.value = '';
      } else {
        alert(data.msg || "Mesaj gönderilemedi.");
      }
    } catch (err) {
      alert("Sunucuya ulaşılamadı.");
    }
  });

  document.getElementById("message-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      document.getElementById("send-btn").click();
    }
  });

  function renderMessage(msg) {
    const messagesDiv = document.getElementById('chat-box');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');

    const myUuid = localStorage.getItem('uuid');
    if (msg.from === myUuid) {
      messageDiv.classList.add('sent-message');
    } else {
      messageDiv.classList.add('received-message');
    }

    messageDiv.dataset.messageText = msg.message;
    messageDiv.innerHTML = `<strong>${msg.username}:</strong> ${msg.message} <span class="message-status">✓ ${msg.status || ''}</span>`;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function renderUserList(users) {
    const userListElement = document.getElementById("online-user-list");
    const myUuid = localStorage.getItem("uuid");

    userListElement.innerHTML = "";

    users.forEach(user => {
      if (user.uuid === myUuid) return;

      const li = document.createElement("li");
      li.textContent = user.username;

      const button = document.createElement("button");
      button.textContent = "Mesaj";
      button.classList.add("private-msg-btn");
      button.onclick = () => {
        const mesaj = prompt(`${user.username} kullanıcısına mesaj:`);
        if (mesaj) {
          const token = localStorage.getItem("jwt");
          socket.emit("send_private_message", {
            token,
            to: user.uuid,
            message: mesaj
          });
        }
      };
      li.appendChild(button);

      const callButton = document.createElement("button");
      callButton.textContent = "Ara";
      callButton.classList.add("call-btn");
      callButton.onclick = () => {
        startCall(user.uuid);
      };
      li.appendChild(callButton);

      userListElement.appendChild(li);
    });
  }

  // ✅ WebRTC Ayarları ve Çağrı Kontrolleri
  let localStream;
  let peerConnection;
  let currentCaller = null;


  let isCalling = false;

const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:localhost:3478',
      username: 'helin',
      credential: '123456'
    }
  ]
};



  function startCall(remoteUuid) {
    peerConnection = new RTCPeerConnection(config);

    socket.emit("incoming_call", {
      to: remoteUuid,
      from: localStorage.getItem("uuid"),
      username: localStorage.getItem("username")
    });

    isCalling = true;

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      localStream = stream;
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

      peerConnection.createOffer().then(offer => {
        return peerConnection.setLocalDescription(offer);
      }).then(() => {
        socket.emit("webrtc_offer", {
          to: remoteUuid,
          offer: peerConnection.localDescription
        });
      });

      peerConnection.ontrack = (event) => {
        const remoteAudio = document.getElementById("remoteAudio");
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play();
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc_ice_candidate", {
            to: remoteUuid,
            candidate: event.candidate
          });
        }
      };
      callingStatus.style.display = "block";
      callingText.textContent = "Aranıyor...";

    }).catch(err => {
      alert("🎤 Mikrofon erişimi reddedildi.");
    });
    endCallBtn.style.display = "inline-block";


  }

  window.acceptCall = async function () {
    document.getElementById("incoming-call").style.display = "none";

    peerConnection = new RTCPeerConnection(config);

    peerConnection.ontrack = (event) => {
      document.getElementById("remoteAudio").srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc_ice_candidate", {
          to: currentCaller,
          candidate: event.candidate
        });
      }
    };

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    socket.emit("call_accepted", { to: currentCaller });
    endCallBtn.style.display = "inline-block";

  };

  window.rejectCall = function () {
    document.getElementById("incoming-call").style.display = "none";
    socket.emit("call_rejected", { to: currentCaller });
    currentCaller = null;
  };
  window.endCall = function () {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  endCallBtn.style.display = "none";
  callingStatus.style.display = "none";

  document.getElementById("remoteAudio").srcObject = null;

  socket.emit("end_call", { to: currentCaller || localStorage.getItem("uuid") });
};


  socket.on("incoming_call", (data) => {
    currentCaller = data.from;
    document.getElementById("caller-name").textContent = `${data.username} sizi arıyor`;
    document.getElementById("incoming-call").style.display = "block";
  });

  socket.on("call_rejected", () => {
    alert("🚫 Çağrı reddedildi.");
    isCalling = false;
    callingStatus.style.display = "none";

  });

  socket.on("call_accepted", () => {
    console.log("✅ Çağrı kabul edildi.");
    callingStatus.style.display = "none";

  });
socket.on("call_ended", () => {
  alert("📴 Çağrı sonlandırıldı.");
  cleanUpCall(); // sadece yerel çağrıyı temizle
});



  socket.on("webrtc_offer", async (data) => {
    peerConnection = new RTCPeerConnection(config);

    peerConnection.ontrack = (event) => {
      const remoteAudio = document.getElementById("remoteAudio");
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.play();
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc_ice_candidate", {
          to: data.from,
          candidate: event.candidate
        });
      }
    };

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("webrtc_answer", {
      to: data.from,
      answer: peerConnection.localDescription
    });
  });

  socket.on("webrtc_answer", async (data) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  });

  socket.on("webrtc_ice_candidate", async (data) => {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {
      console.error("ICE adayı eklenemedi:", e);
    }
  });

});
