// public/js/room.js

class VideoMeetingApp {
  constructor(roomId, userName) {
    this.roomId = roomId;
    this.userName = userName;
    this.userId = this.generateUserId();
    this.localVideo = document.getElementById("localVideo");
    this.videosContainer = document.getElementById("videosContainer");
    this.participantList = document.getElementById("participantList");
    this.participantCount = document.getElementById("participantCount");

    this.rtcConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
      iceCandidatePoolSize: 10,
    };

    this.localStream = null;
    this.peers = {};
    this.isVideoOn = true;
    this.isAudioOn = true;

    this.setupSocket();
    this.setupControls();
    this.initializeMedia();
  }

  generateUserId() {
    return Math.random().toString(36).substring(2, 15);
  }

  setupSocket() {
    this.socket = io();

    this.socket.on("connect", () => {
      console.log("Socket bağlandı:", this.socket.id);
      this.socket.emit("join-room", this.roomId, this.userId, this.userName);
    });

    this.socket.on("user-connected", (userId, userName) => {
      console.log("Yeni kullanıcı bağlandı:", userName, userId);
      this.addParticipant(userId, userName);
      // Yeni kullanıcıya offer gönder (Mevcut kullanıcılar başlatır)
      this.createPeerConnection(userId, true);
    });

    this.socket.on("user-disconnected", (userId) => {
      console.log("Kullanıcı ayrıldı:", userId);
      this.removeParticipant(userId);
      if (this.peers[userId]) {
        this.peers[userId].close();
        delete this.peers[userId];
      }
    });

    // ****** DÜZELTİLEN BÖLÜM BURASI ******
    this.socket.on("existing-users", (users) => {
      console.log("Mevcut kullanıcılar:", users);
      users.forEach((user) => {
        this.addParticipant(user.id, user.name);
        // Mevcut kullanıcılardan gelecek offer'ı beklemek için bağlantı oluştur
        // Bu yüzden 'isInitiator' false olmalı.
        this.createPeerConnection(user.id, false);
      });
    });
    // ***************************************

    this.socket.on("offer", async (data) => {
      console.log("Offer alındı:", data.from);
      await this.handleOffer(data.offer, data.from);
    });

    this.socket.on("answer", async (data) => {
      console.log("Answer alındı:", data.from);
      await this.handleAnswer(data.answer, data.from);
    });

    this.socket.on("ice-candidate", async (data) => {
      console.log("ICE candidate alındı:", data.from);
      await this.handleIceCandidate(data.candidate, data.from);
    });
  }

  async initializeMedia() {
    try {
      console.log("Medya erişimi isteniyor...");

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.localVideo.srcObject = this.localStream;
      this.addParticipant(this.userId, this.userName + " (Sen)");

      console.log("Medya erişimi başarılı");
    } catch (error) {
      console.error("Medya erişim hatası:", error);
      this.handleMediaError(error);
    }
  }

  async createPeerConnection(userId, isInitiator) {
    console.log(
      "Peer connection oluşturuluyor:",
      userId,
      "Initiator:",
      isInitiator
    );

    const peerConnection = new RTCPeerConnection(this.rtcConfig);
    this.peers[userId] = peerConnection;

    peerConnection.onconnectionstatechange = () => {
      console.log(`Peer ${userId} durumu:`, peerConnection.connectionState);
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE ${userId} durumu:`, peerConnection.iceConnectionState);
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log("Track ekleniyor:", track.kind);
        peerConnection.addTrack(track, this.localStream);
      });
    }

    peerConnection.ontrack = (event) => {
      console.log("Remote track alındı:", userId, event.track.kind);
      const remoteStream = event.streams[0];
      this.addRemoteVideo(userId, remoteStream);
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("ICE candidate gönderiliyor:", userId);
        this.socket.emit("ice-candidate", {
          from: this.userId,
          to: userId,
          candidate: event.candidate,
        });
      }
    };

    if (isInitiator) {
      try {
        console.log("Offer oluşturuluyor...");
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });

        await peerConnection.setLocalDescription(offer);

        this.socket.emit("offer", {
          from: this.userId,
          to: userId,
          offer: offer,
        });

        console.log("Offer gönderildi:", userId);
      } catch (error) {
        console.error("Offer oluşturma hatası:", error);
      }
    }
  }

  async handleOffer(offer, fromUserId) {
    console.log("Offer işleniyor:", fromUserId);

    if (!this.peers[fromUserId]) {
      // Offer geldiğinde, bu taraf initiator değildir.
      await this.createPeerConnection(fromUserId, false);
    }

    const peerConnection = this.peers[fromUserId];

    try {
      await peerConnection.setRemoteDescription(offer);
      console.log("Remote description set edildi");

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      this.socket.emit("answer", {
        from: this.userId,
        to: fromUserId,
        answer: answer,
      });

      console.log("Answer gönderildi:", fromUserId);
    } catch (error) {
      console.error("Offer işleme hatası:", error);
    }
  }

  async handleAnswer(answer, fromUserId) {
    console.log("Answer işleniyor:", fromUserId);

    const peerConnection = this.peers[fromUserId];
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(answer);
        console.log("Answer işlendi:", fromUserId);
      } catch (error) {
        console.error("Answer işleme hatası:", error);
      }
    }
  }

  async handleIceCandidate(candidate, fromUserId) {
    const peerConnection = this.peers[fromUserId];
    if (peerConnection && candidate) {
      try {
        await peerConnection.addIceCandidate(candidate);
        console.log("ICE candidate eklendi:", fromUserId);
      } catch (error) {
        console.error("ICE candidate ekleme hatası:", error);
      }
    }
  }

  addRemoteVideo(userId, stream) {
    console.log("Remote video ekleniyor:", userId);

    let videoWrapper = document.getElementById(`wrapper-${userId}`);

    if (!videoWrapper) {
      videoWrapper = document.createElement("div");
      videoWrapper.className = "video-wrapper";
      videoWrapper.id = `wrapper-${userId}`;
      videoWrapper.innerHTML = `
        <video id="video-${userId}" autoplay playsinline></video>
        <div class="video-label">${this.getParticipantName(userId)}</div>
      `;
      this.videosContainer.appendChild(videoWrapper);
    }

    const video = videoWrapper.querySelector("video");
    video.srcObject = stream;

    video.play().catch((e) => console.log("Video oynatma hatası:", e));
  }

  addParticipant(userId, userName) {
    if (document.getElementById(`participant-${userId}`)) {
      return;
    }

    const participantItem = document.createElement("div");
    participantItem.className = "participant-item";
    participantItem.id = `participant-${userId}`;
    participantItem.textContent = userName;

    this.participantList.appendChild(participantItem);
    this.updateParticipantCount();
  }

  removeParticipant(userId) {
    const participantItem = document.getElementById(`participant-${userId}`);
    if (participantItem) {
      participantItem.remove();
    }

    const videoWrapper = document.getElementById(`wrapper-${userId}`);
    if (videoWrapper) {
      videoWrapper.remove();
    }

    this.updateParticipantCount();
  }

  getParticipantName(userId) {
    const participantItem = document.getElementById(`participant-${userId}`);
    return participantItem ? participantItem.textContent : "Bilinmeyen";
  }

  updateParticipantCount() {
    const count = this.participantList.children.length;
    this.participantCount.textContent = count;
  }

  setupControls() {
    const muteBtn = document.getElementById("muteBtn");
    const videoBtn = document.getElementById("videoBtn");
    const leaveBtn = document.getElementById("leaveBtn");

    muteBtn.addEventListener("click", () => this.toggleAudio());
    videoBtn.addEventListener("click", () => this.toggleVideo());
    leaveBtn.addEventListener("click", () => this.leaveRoom());
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.isAudioOn = audioTrack.enabled;

        const muteBtn = document.getElementById("muteBtn");
        muteBtn.textContent = this.isAudioOn ? "🎤" : "🔇";
        muteBtn.classList.toggle("muted", !this.isAudioOn);
      }
    }
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.isVideoOn = videoTrack.enabled;

        const videoBtn = document.getElementById("videoBtn");
        videoBtn.textContent = this.isVideoOn ? "📹" : "📷";
        videoBtn.classList.toggle("video-off", !this.isVideoOn);
      }
    }
  }

  leaveRoom() {
    if (confirm("Odadan ayrılmak istediğinize emin misiniz?")) {
      Object.values(this.peers).forEach((peer) => {
        peer.close();
      });

      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => track.stop());
      }

      this.socket.disconnect();
      window.location.href = "/";
    }
  }

  handleMediaError(error) {
    let message = "";

    switch (error.name) {
      case "NotAllowedError":
        message =
          'Kamera/mikrofon erişimi reddedildi!\n\nÇözüm:\n1. Adres çubuğundaki kamera simgesine tıklayın\n2. "İzin Ver" seçeneğini seçin\n3. Sayfayı yenileyin';
        break;
      case "NotFoundError":
        message = "Kamera veya mikrofon bulunamadı!";
        break;
      case "NotReadableError":
        message = "Kamera/mikrofon başka uygulama tarafından kullanılıyor!";
        break;
      default:
        message = "Medya erişim hatası: " + error.message;
    }

    alert(message);
  }
}
