# Task Management System Backend

A Node.js/Express backend for a task management system with user authentication and MongoDB Atlas integration.

## Features

- User registration and login with JWT authentication
- Project management (CRUD operations)
- Task management (CRUD operations)
- Comments on tasks
- MongoDB Atlas database integration

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with the following variables:
   ```
   PORT=5000
   MONGODB_URI=your_mongodb_atlas_connection_string
   JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production
   JWT_EXPIRES_IN=7d
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication

#### Register
- **POST** `/api/auth/register`
- **Body**: `{ "name": "string", "email": "string", "password": "string" }`

#### Login
- **POST** `/api/auth/login`
- **Body**: `{ "email": "string", "password": "string" }`

#### Get Profile
- **GET** `/api/auth/profile`
- **Headers**: `Authorization: Bearer <token>`

### Projects

#### Get All Projects
- **GET** `/api/projects`
- **Headers**: `Authorization: Bearer <token>`

#### Get Single Project
- **GET** `/api/projects/:id`
- **Headers**: `Authorization: Bearer <token>`

#### Create Project
- **POST** `/api/projects`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: `{ "name": "string", "description": "string" }`

#### Update Project
- **PUT** `/api/projects/:id`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: `{ "name": "string", "description": "string" }`

#### Delete Project
- **DELETE** `/api/projects/:id`
- **Headers**: `Authorization: Bearer <token>`

### Tasks

#### Get All Tasks
- **GET** `/api/tasks`
- **Headers**: `Authorization: Bearer <token>`
- **Query**: `?projectId=<project_id>` (optional)

#### Get Single Task
- **GET** `/api/tasks/:id`
- **Headers**: `Authorization: Bearer <token>`

#### Create Task
- **POST** `/api/tasks`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "title": "string",
    "description": "string",
    "projectId": "objectId",
    "status": "backlog|in_progress|in_review|done",
    "priority": "low|medium|high|urgent",
    "assigneeIds": ["objectId"],
    "dueDate": "date",
    "tags": ["string"]
  }
  ```

#### Update Task
- **PUT** `/api/tasks/:id`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: Same as create, except id

#### Add Comment to Task
- **POST** `/api/tasks/:id/comments`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: `{ "text": "string" }`

#### Delete Task
- **DELETE** `/api/tasks/:id`
- **Headers**: `Authorization: Bearer <token>`

## Database Models

### User
- name: String (required)
- email: String (required, unique)
- password: String (required, hashed)
- createdAt: Date

### Project
- name: String (required)
- description: String
- userId: ObjectId (ref: User)
- createdAt: Date
- updatedAt: Date

### Task
- title: String (required)
- description: String
- projectId: ObjectId (ref: Project)
- userId: ObjectId (ref: User)
- status: String (enum: backlog, in_progress, in_review, done)
- priority: String (enum: low, medium, high, urgent)
- assigneeIds: [ObjectId] (ref: User)
- dueDate: Date
- tags: [String]
- comments: [{ userId: ObjectId, text: String, createdAt: Date }]
- activity: [String]
- createdAt: Date
- updatedAt: Date

## Technologies Used

- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- bcryptjs (password hashing)
- jsonwebtoken (JWT authentication)
- cors
- dotenv