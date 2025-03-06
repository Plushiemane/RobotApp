import { useState } from 'react'
import './App.css'

function App() {
	const [connected, setConnected] = useState(false)
	const [speed, setSpeed] = useState(0)
	const [steering, setSteering] = useState(0)
	const [robotIp, setRobotIp] = useState("127.0.0.30:8000")

	const handleConnect = async () => {
		try {
			// Simulate pinging the robot with a GET request
			const response = await fetch(`http://${robotIp}`);
			if(response.ok){
				setConnected(true)
				console.log(`Connected to robot at ${robotIp}`)
			} else {
				console.error('Ping failed')
			}
		} catch (error) {
			console.error('Ping error:', error)
		}
	}

	const handleMoveForward = () => {
		console.log('Moving forward')
	}

	const handleMoveBackward = () => {
		console.log('Moving backward')
	}

	const handleSendExampleFrame = async () => {
		const payload = new Uint8Array([0x01, 0x20, 0x50])
		try {
			const response = await fetch("http://127.0.0.30:8000", {
				method: "POST",
				headers: { "Content-Type": "application/octet-stream" },
				body: payload
			})
			if(response.ok){
				console.log("Frame sent successfully")
			} else {
				console.error("Failed to send frame")
			}
		} catch (error) {
			console.error("Error sending frame:", error)
		}
	}

	return (
		<div className="app-container">
			<h1>Robot Controller</h1>
			
			{/* Robot IP Input */}
			<div>
				<label>Robot IP: </label>
				<input 
					type="text" 
					value={robotIp} 
					onChange={(e) => setRobotIp(e.target.value)} 
				/>
			</div>
			
			<button onClick={handleConnect}>Connect Robot</button>
			<button onClick={handleMoveForward}>Move Forward</button>
			<button onClick={handleMoveBackward}>Move Backward</button>
			<p>{connected ? `Connected to robot at ${robotIp}` : "Not Connected"}</p>
			
			{/* Speed Slider */}
			<div>
				<label>Speed: {speed}</label>
				<input 
					type="range" 
					min="-128" 
					max="127" 
					value={speed} 
					onChange={(e) => setSpeed(Number(e.target.value))} 
				/>
			</div>
			<button className='card'>
        LED 2
      </button>

      <button className='card' onClick={handleSendExampleFrame}>
        LED 1
      </button>
			{/* Steering Slider */}
			<div>
				<label>Steering: {steering}</label>
				<input 
					type="range" 
					min="-128" 
					max="127" 
					value={steering} 
					onChange={(e) => setSteering(Number(e.target.value))} 
				/>
			</div>
		</div>
	)
}

export default App
