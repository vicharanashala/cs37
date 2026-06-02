# cs37 - CrowdSource FAQ

A full-stack application combining Next.js frontend, Python RAG API backend, and MongoDB integration.

## Quick Start

### Prerequisites
- **Python 3.8+** (for RAG service)
- **Node.js 18+** & **npm** (for Next.js web app)
- **Git**

### Getting Started

Choose your operating system and run the appropriate startup script:

#### macOS / Linux
```bash
chmod +x start.sh
./start.sh
```

#### Windows (Command Prompt / PowerShell)

**Option 1: Command Prompt (Batch Script)**
```batch
start.bat
```

**Option 2: PowerShell**
```powershell
# First time only - allow script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run the startup script
.\start.ps1
```

## What the Start Script Does

The startup script automates the entire setup process:

1. **Checks Prerequisites** - Verifies Python, Node.js, and npm are installed
2. **RAG Service Setup** - Creates Python virtual environment and installs dependencies
3. **RAG Service Config** - Copies `.env.example` to `.env` if needed (configure GEMINI_API_KEY)
4. **Next.js Setup** - Installs npm dependencies for the web app
5. **Next.js Config** - Copies `.env.example` to `.env.local` if needed (configure MONGODB_URI and GEMINI_API_KEY)
6. **Starts RAG API** - Runs on http://localhost:8000
7. **Starts Next.js Dev Server** - Runs on http://localhost:3000

## Configuration

After running the start script, you need to configure environment variables:

### RAG Service (`rag-service/RAG_pipeline/.env`)
```
GEMINI_API_KEY=your_api_key_here
```

### Web App (`faq-web/.env.local`)
```
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_api_key_here
```

## Project Structure

- **faq-web/** - Next.js frontend application
- **rag-service/** - Python RAG (Retrieval-Augmented Generation) API backend
- **start.sh** - Startup script for macOS/Linux
- **start.bat** - Startup script for Windows Command Prompt
- **start.ps1** - Startup script for Windows PowerShell

## Development

Once the servers are running:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **RAG Docs:** http://localhost:8000/docs

## Troubleshooting

### Python issues
- Ensure Python 3.8+ is installed and in PATH
- Try running `python3` instead of `python` on some systems

### Node.js issues
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`, then retry

### Port conflicts
- RAG API uses port 8000
- Next.js uses port 3000
- Ensure these ports are available or modify the startup scripts