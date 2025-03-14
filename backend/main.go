package main

import (
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"time"
)

const (
	robotAddress = "100.105.5.12:8000" // Default robot address
	mockMode     = false               // Set to true for testing without a robot
	connTimeout  = 3 * time.Second     // Connection timeout
	readTimeout  = 5 * time.Second     // Read timeout
)

func main() {
	// Set up HTTP server to receive commands from frontend
	http.HandleFunc("/", handleRequest)
	
	fmt.Println("Starting server on :3000")
	log.Printf("Robot address: %s, Mock mode: %v", robotAddress, mockMode)
	log.Fatal(http.ListenAndServe(":3000", nil))
}

func handleRequest(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	
	// Handle OPTIONS preflight request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	
	// Handle GET request (ping)
	if r.Method == "GET" {
		if mockMode {
			fmt.Fprintf(w, "[0064FF1122]") // Return mock data in expected format
			return
		}
		
		// Try to connect to the robot to verify it's available
		conn, err := net.DialTimeout("tcp", robotAddress, connTimeout)
		if err != nil {
			log.Printf("Robot ping failed: %v", err)
			http.Error(w, fmt.Sprintf("Could not connect to robot: %v", err), http.StatusServiceUnavailable)
			return
		}
		defer conn.Close()
		fmt.Fprintf(w, "Robot is available")
		return
	}
	
	// Handle POST request (send frame)
	if r.Method == "POST" {
		// For mock mode, return simulated data
		if mockMode {
			fmt.Fprintf(w, "[0064FF1122]") // Return mock data in expected format
			return
		}
		
		// Read the frame from the request body
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, fmt.Sprintf("Error reading request body: %v", err), http.StatusBadRequest)
			return
		}
		defer r.Body.Close()
		
		// Format the message to ensure it has proper brackets
		message := string(body)
		
		// Connect to the robot with timeout
		conn, err := net.DialTimeout("tcp", robotAddress, connTimeout)
		if err != nil {
			log.Printf("Failed to connect to robot: %v", err)
			http.Error(w, fmt.Sprintf("Could not connect to robot: %v", err), http.StatusServiceUnavailable)
			return
		}
		defer conn.Close()
		
		// Set read/write timeouts
		conn.SetDeadline(time.Now().Add(readTimeout))
		
		log.Printf("Sending frame to robot: %s", message)
		
		// Send the formatted frame to the robot
		_, err = conn.Write([]byte(message))
		if err != nil {
			log.Printf("Error sending frame: %v", err)
			http.Error(w, fmt.Sprintf("Error sending frame to robot: %v", err), http.StatusInternalServerError)
			return
		}
		
		// Read response from robot
		buffer := make([]byte, 1024)
		n, err := conn.Read(buffer)
		if err != nil {
			if err.Error() == "EOF" {
				fmt.Fprintf(w, "Frame sent successfully, but no response received")
				return
			}
			http.Error(w, fmt.Sprintf("Error reading response from robot: %v", err), http.StatusInternalServerError)
			return
		}
		
		response := string(buffer[:n])
		log.Printf("Received robot response: %s", response)
		
		// Send robot's response back to client
		fmt.Fprintf(w, "%s", response)
		return
	}
	
	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}
