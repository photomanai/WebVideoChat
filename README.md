# Web Video Chat 💬📹

This project is a modern browser-based video chat application built with `Node.js`, `Express.js`, and `Socket.IO`.
It allows users to join unique rooms and share video and audio streams in real time.

## Features

- **Real-Time Communication:** Uses `WebRTC` (Web Real-Time Communication) to establish direct peer-to-peer connections between browsers.
- **Dynamic Rooms:** Users can join dynamically generated rooms.
- **Video & Audio Controls:** Basic controls such as toggling microphone and camera.
- **Participant List:** A collapsible list displaying all participants in the room.
- **Responsive Design:** UI built with Tailwind CSS for seamless experience on both desktop and mobile devices.
- **Signaling via Socket.IO:** The signaling process (offer, answer, ICE candidate) required for WebRTC connections is securely handled with `Socket.IO`.

## Installation

Follow these steps to run the project locally:

### Prerequisites

- [Node.js](https://nodejs.org/) (preferably LTS version)
- [npm](https://www.npmjs.com/) (comes with Node.js)

### Steps

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/photomanai/WebVideoChat.git
   cd WebVideoChat
   ```

2. **Install Dependencies:**

   ```bash
   npm install express socket.io ejs
   ```

3. **Start the Server:**

   ```bash
   npm run dev
   ```

4. **Access the App:**
   Open your browser and go to:

   ```
   http://localhost:3000
   ```

---

## Important: HTTPS Requirement 🔒

WebRTC requires a **secure context** (HTTPS) in production. Running the app on plain HTTP may cause the camera and microphone not to work.

For local testing, you can use [ngrok](https://ngrok.com/) to expose your local server with HTTPS:

```bash
# Run the server locally
node server.js

# In another terminal, run ngrok
ngrok http 3000
```

ngrok will provide you with a public HTTPS URL (e.g., `https://random-id.ngrok.app`).
Share this URL with your friends to join the same room securely.

---

## Usage

- Go to the homepage (`/`) to create a new room or join an existing one.
- Enter a unique room ID (`roomId`) and share the link with your friends.
- Once inside, allow access to your **microphone** and **camera**.
- Use the bottom control buttons to manage video/audio settings.
- Click the **participants icon** at the bottom-right to see who’s in the room.
- To leave the meeting, click the **Leave** button.

---

## Project Structure

```
/
├── public/
│   ├── css/
│   │   └── room.css          # UI styles
│   └── js/
│       └── room.js           # Frontend JavaScript
├── views/
│   ├── index.ejs             # Homepage
│   └── room.ejs              # Video chat room page
├── .gitignore                # Ignored files for Git
├── package.json              # Project dependencies & scripts
└── server.js                 # Server & Socket.IO logic
```

---

## Contributing

Contributions are welcome! Feel free to open pull requests for new features, bug fixes, or improvements.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
