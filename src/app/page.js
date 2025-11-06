"use client";

import { useState, useEffect } from "react";
import { db } from "./firebase"; 

// Import NEW functions: doc, updateDoc, deleteDoc
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc,        // Gets a reference to a specific document
  updateDoc,  // Updates a document
  deleteDoc   // Deletes a document
} from "firebase/firestore";

export default function TodoPage() {
  
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");

  
  // --- (This function is unchanged) ---
  const fetchTasks = async () => {
    const querySnapshot = await getDocs(collection(db, "tasks"));
    const tasksArray = [];
    querySnapshot.forEach((doc) => {
      tasksArray.push({ id: doc.id, ...doc.data() });
    });
    setTasks(tasksArray);
  };

  
  // --- (This hook is unchanged) ---
  useEffect(() => {
    fetchTasks();
  }, []); 

  
  // --- (This function is unchanged) ---
  const handleAddTask = async () => {
    if (newTask.trim() === "") return; 

    try {
      await addDoc(collection(db, "tasks"), {
        text: newTask,
        isCompleted: false
      });
      setNewTask("");
      fetchTasks(); 
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  // --- ⬇️ NEW FUNCTION: DELETE (The "D" in CRUD) ⬇️ ---
  const handleDelete = async (id) => {
    try {
      // Get a reference to the specific task document
      const taskDocRef = doc(db, "tasks", id);
      
      // Delete the document
      await deleteDoc(taskDocRef);
      
      // Refresh the task list
      fetchTasks();
    } catch (e) {
      console.error("Error deleting document: ", e);
    }
  };

  // --- ⬇️ NEW FUNCTION: UPDATE (The "U" in CRUD) ⬇️ ---
  const handleToggleComplete = async (id, isCompleted) => {
    try {
      // Get a reference to the specific task document
      const taskDocRef = doc(db, "tasks", id);
      
      // Update the 'isCompleted' field to be the opposite of what it was
      await updateDoc(taskDocRef, {
        isCompleted: !isCompleted
      });
      
      // Refresh the task list
      fetchTasks();
    } catch (e) {
      console.error("Error updating document: ", e);
    }
  };


  // --- ⬇️ UPDATED JSX (HTML) ⬇️ ---
 // --- (All your functions: fetchTasks, useEffect, handleAddTask, etc. stay the same) ---


  // --- ⬇️ UPDATED JSX (HTML) ⬇️ ---
  return (
    // 1. Changed padding: small on mobile (p-6), large on desktop (md:p-24)
    <main className="flex min-h-screen flex-col items-center p-6 md:p-24">
      <h1 className="text-4xl font-bold mb-8">My To-Do List</h1>

      {/* 2. Form container:
             - Stacks vertically by default (flex-col)
             - Becomes horizontal on small screens and up (sm:flex-row)
             - Full width by default
             - Constrained to 'max-w-md' on desktop
      */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 w-full max-w-md">
        <input
          type="text"
          value={newTask} 
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Enter a new task"
          // 3. Input:
          //    - Full width by default (w-full)
          //    - Resets width automatically on larger screens
          className="border p-2 rounded text-black w-full"
        />
        <button
          onClick={handleAddTask}
          // 4. Button:
          //    - Full width by default (w-full)
          //    - Auto width on larger screens (sm:w-auto)
          className="bg-blue-500 text-white px-4 py-2 rounded w-full sm:w-auto"
        >
          Add Task
        </button>
      </div>

      {/* 5. List:
            - Full width by default
            - Constrained to 'max-w-md' on desktop
      */}
      <ul className="w-full max-w-md">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={`
              p-3 mb-2 rounded flex justify-between items-center
              ${task.isCompleted ? "bg-green-200 text-green-800" : "bg-gray-100 text-black"}
            `}
          >
            <span 
              className={`cursor-pointer ${task.isCompleted ? "line-through" : ""}`}
              onClick={() => handleToggleComplete(task.id, task.isCompleted)}
            >
              {task.text}
            </span>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(task.id)}
                className="bg-red-500 text-white px-3 py-1 rounded"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}