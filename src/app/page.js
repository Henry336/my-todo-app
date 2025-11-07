"use client";

import { useState, useEffect, useMemo } from "react";
import { db, auth } from "./firebase"; 

// 👈 --- NEW AUTH IMPORTS ---
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword, // For Sign Up
  signInWithEmailAndPassword    // For Sign In
} from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";

import { 
  collection, 
  addDoc, 
  getDocs, 
  doc,        
  updateDoc,  
  deleteDoc,
  query,       
  orderBy,     
  writeBatch,
  where
} from "firebase/firestore";

// --- DND-KIT IMPORTS ---
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// --- END IMPORTS ---


// -----------------------------------------------------------------
// 1. SORTABLE TASK ITEM COMPONENT (Unchanged)
// -----------------------------------------------------------------
function SortableTaskItem({ task, index, handleToggleComplete, handleDelete, handleUpdateTask, today }) {
  
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [editDate, setEditDate] = useState(task.dueDate || "");
  // 👈 --- NEW LOGIC FOR DATE WARNINGS ---
  const checkDateWarning = () => {
    if (!task.dueDate) return null; // No warning if no due date
    
    const dueDate = new Date(task.dueDate);
    const todayDate = new Date(today);
    const tomorrowDate = new Date(today);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1); // Get tomorrow's date

    // Set time of all dates to midnight for fair comparison
    dueDate.setHours(0, 0, 0, 0);
    todayDate.setHours(0, 0, 0, 0);

    // Ignore completed tasks
    if (task.isCompleted) return null;

    // Check if the task is past due (due date is yesterday or earlier)
    if (dueDate < todayDate) {
      return 'past';
    }

    // Check if the task is due today
    if (dueDate.toDateString() === todayDate.toDateString()) {
      return 'today';
    }
    
    // Check if the task is due tomorrow
    if (dueDate.toDateString() === tomorrowDate.toDateString()) {
        return 'tomorrow';
    }

    return null; // No immediate warning
  };
  
  const dateWarning = checkDateWarning();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const isPriorityOne = index === 0;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const onSave = () => {
    if (editText.trim() === "") return;
    handleUpdateTask(task.id, editText, editDate);
    setIsEditing(false);
  };

  const onCancel = () => {
    setIsEditing(false);
    setEditText(task.text);
    setEditDate(task.dueDate || "");
  };


  // --- "EDIT" VIEW ---
  if (isEditing) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className="p-3 mb-2 rounded bg-white text-black flex flex-col gap-2 shadow-sm"
      >
        <input 
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="border p-2 rounded text-black w-full"
        />
        <div className="flex justify-between gap-2">
          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            className="border p-2 rounded text-black w-full"
            min={today}
          />
          <div className="flex gap-2">
            <button onClick={onSave} className="bg-green-500 text-white px-3 py-1 rounded">Save</button>
            <button onClick={onCancel} className="bg-gray-400 text-white px-3 py-1 rounded">Cancel</button>
          </div>
        </div>
      </li>
    );
  }

  // --- "DISPLAY" VIEW ---
  return (
    <li
  ref={setNodeRef}
  style={style}
  className={`
    p-3 mb-2 rounded flex justify-between items-center
    // 1. Change background based on status/warning
    ${task.isCompleted 
      ? "bg-gray-400 text-gray-600 shadow-sm" // Completed: Gray
      : (dateWarning === 'past' 
        ? "bg-red-200 text-red-800 shadow-lg" // Past due: RED ALERT
        : (dateWarning === 'today' || dateWarning === 'tomorrow'
          ? "bg-yellow-200 text-yellow-800 shadow-md" // Near future: YELLOW WARNING
          : "bg-white text-black shadow-sm" // Normal: White
        )
      )
    }
  `}
>
      <div 
        {...attributes} 
        {...listeners} 
        className={`
          p-2 cursor-grab w-10 text-center font-bold transition-all
          ${isPriorityOne ? 'text-red-500 text-lg' : 'text-gray-500'}
          ${isDragging ? '' : (isPriorityOne ? 'animate-pulse-warning' : 'animate-tilt')}
        `}
      >
        {index + 1}
      </div>

      <div className="flex-grow cursor-pointer" onClick={() => handleToggleComplete(task.id, task.isCompleted)}>
        <span className={` ${task.isCompleted ? "line-through" : ""}`}>
          {task.text}
        </span>
        {task.dueDate && (
          <p className={`text-xs ${task.isCompleted ? 'text-gray-600' : 'text-gray-500'}`}>
            Due: {task.dueDate}
          </p>
        )}
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={() => setIsEditing(true)}
          className="bg-yellow-500 text-white px-3 py-1 rounded"
        >
          Edit
        </button>
        <button
          onClick={() => handleDelete(task.id)}
          className="bg-red-500 text-white px-3 py-1 rounded"
        >
          Delete
        </button>
      </div>
    </li>
  );
}


// -----------------------------------------------------------------
// 2. OUR MAIN PAGE COMPONENT (UPDATED WITH AUTH)
// -----------------------------------------------------------------
export default function TodoPage() {
  
  const [user, loading, error] = useAuthState(auth);
  
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [filter, setFilter] = useState("all");

  // 👈 --- NEW STATE FOR EMAIL/PASS LOGIN ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(null);

  // 👈 --- NEW STATE ---
  const [showPassword, setShowPassword] = useState(false); 
  
  // --- SVG ICONS (Eye and Eye-Off) ---
  const EyeIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
      <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
      <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
    </svg>
  );

  const EyeOffIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
      <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
      <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
    </svg>
  );

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  }));

  // --- AUTH FUNCTIONS ---

  const googleProvider = new GoogleAuthProvider();
  const handleGoogleSignIn = async () => {
    setAuthError(null); // Clear errors
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  // 👈 --- NEW EMAIL/PASS "SIGN UP" FUNCTION ---
  const handleSignUp = async (e) => {
    e.preventDefault(); // Stop form from refreshing
    setAuthError(null);
    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters long.");
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setEmail('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  // 👈 --- NEW EMAIL/PASS "SIGN IN" FUNCTION ---
  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setEmail('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };


  // --- FIRESTORE FUNCTIONS (UNCHANGED) ---

  const fetchTasks = async () => {
    if (!user) return; 
    
    const tasksCollectionRef = collection(db, "tasks");
    const q = query(
      tasksCollectionRef, 
      where("userId", "==", user.uid),
      orderBy("order", "asc")
    );
    
    const querySnapshot = await getDocs(q);
    const tasksArray = [];
    querySnapshot.forEach((doc) => {
      tasksArray.push({ id: doc.id, ...doc.data() });
    });
    setTasks(tasksArray);
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const handleAddTask = async () => {
    if (newTask.trim() === "" || !user) return;
    try {
      await addDoc(collection(db, "tasks"), {
        text: newTask,
        isCompleted: false,
        order: tasks.length,
        dueDate: newDueDate || null,
        userId: user.uid
      });
      setNewTask("");
      setNewDueDate("");
      fetchTasks(); 
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  const handleClearCompleted = async () => {
    if (!user) return;
    const completedTasks = tasks.filter(task => task.isCompleted);
    if (completedTasks.length === 0) return;
    try {
      const batch = writeBatch(db);
      completedTasks.forEach(task => {
        const taskRef = doc(db, "tasks", task.id);
        batch.delete(taskRef);
      });
      await batch.commit();
      fetchTasks();
    } catch (e) {
      console.error("Error clearing completed tasks: ", e);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault(); 
    handleAddTask(); 
  };

  const handleUpdateTask = async (id, newText, newDate) => {
    if (!user) return;
    try {
      const taskDocRef = doc(db, "tasks", id);
      await updateDoc(taskDocRef, {
        text: newText,
        dueDate: newDate || null
      });
      fetchTasks();
    } catch (e) {
      console.error("Error updating document: ", e);
    }
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try {
      const taskDocRef = doc(db, "tasks", id);
      await deleteDoc(taskDocRef);
      fetchTasks();
    } catch (e) {
      console.error("Error deleting document: ", e);
    }
  };

  const handleToggleComplete = async (id, isCompleted) => {
    if (!user) return;
    try {
      const taskDocRef = doc(db, "tasks", id);
      await updateDoc(taskDocRef, {
        isCompleted: !isCompleted
      });
      fetchTasks();
    } catch (e) {
      console.error("Error updating document: ", e);
    }
  };

  const handleDragEnd = async (event) => {
    if (!user) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);
      const newOrder = arrayMove(tasks, oldIndex, newIndex);
      setTasks(newOrder); 
      try {
        const batch = writeBatch(db);
        newOrder.forEach((task, index) => {
          const taskRef = doc(db, "tasks", task.id);
          batch.update(taskRef, { order: index });
        });
        await batch.commit();
      } catch (e) {
        console.error("Error updating order in Firebase: ", e);
        fetchTasks();
      }
    }
  };

  const filteredTasks = useMemo(() => {
    if (filter === "active") {
      return tasks.filter(task => !task.isCompleted);
    }
    if (filter === "completed") {
      return tasks.filter(task => task.isCompleted);
    }
    return tasks;
  }, [tasks, filter]);

  
  // -----------------------------------------------------------------
  // 3. MAIN JSX (RETURN - UPDATED WITH NEW LOGIN FORM)
  // -----------------------------------------------------------------
  
  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-100">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-24 bg-gray-100">
      
      <div className="w-full max-w-md flex justify-between items-center mb-8">
        <h1 className="text-5xl font-extrabold text-gray-900">
          My To-Do List
        </h1>
        {user && (
          <button 
            onClick={handleSignOut} 
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
          >
            Sign Out
          </button>
        )}
      </div>

      {!user ? (
        // --- 👈 NEW LOGIN SCREEN ---
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
          
          {/* Email/Password Form */}
          <form className="flex flex-col gap-3">
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="border p-2 rounded text-black w-full"
            />
            {/* Password Input with Toggle */}
            <div className="relative">
              <input
                // 👈 1. Toggle type based on state
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (6+ characters)"
                className="border p-2 rounded text-black w-full pr-10" // Added pr-10 for icon space
              />
              {/* 👈 2. The Eye Icon Button */}
              <button
                type="button" // Important: Prevents form submission
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {/* 3. Toggle Icon Display */}
                {showPassword ? EyeIcon : EyeOffIcon} 
              </button>
            </div>
            
            {/* Show error message if it exists */}
            {authError && (
              <p className="text-red-500 text-sm text-center">
                {/* This expression cleans up the raw Firebase error for the user */}
                {authError.replace("Firebase: ", "").replace(/\s*\(auth[^)]*\)/g, "")}
              </p>
            )}

           <div className="flex gap-2">
  <button
    onClick={(e) => handleSignIn(e)}
    className="border p-2 rounded w-full bg-indigo-600 text-white font-medium hover:bg-indigo-700"
  >
    Sign In
  </button>
  <button
    onClick={(e) => handleSignUp(e)}
    className="border p-2 rounded w-full bg-gray-200 text-gray-800 font-medium hover:bg-gray-300"
  >
    Sign Up
  </button>
</div>
          </form>

          {/* Divider */}
          <div className="flex items-center my-4">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-sm">OR</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          {/* Google Sign-in Button */}
          <button 
            onClick={handleGoogleSignIn}
            className="bg-blue-500 text-white p-2 rounded w-full font-medium hover:bg-blue-600"
          >
            Sign in with Google
          </button>
        </div>

      ) : (
        // --- IF LOGGED IN, SHOW THE APP ---
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">

          {/* --- Form --- */}
          <form 
            onSubmit={handleSubmit}
            className="flex flex-col gap-2 mb-4 w-full"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newTask} 
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Enter a new task"
                className="border p-2 rounded text-black w-full"
              />
              <button
                type="submit"
                className="bg-indigo-600 text-white px-4 py-2 rounded w-full sm:w-auto"
              >
                Add Task
              </button>
            </div>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="border p-2 rounded text-black w-full"
              min={today}
            />
          </form>

          {/* --- List Section --- */}
          <div className="w-full">
            
            {/* --- Filter Buttons --- */}
            <div className="flex justify-center gap-2 mb-4 border-b pb-4">
              <button 
                onClick={() => setFilter("all")}
                className={`px-3 py-1 text-sm rounded-lg ${filter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-200'}`}
              >
                All
              </button>
              <button 
                onClick={() => setFilter("active")}
                className={`px-3 py-1 text-sm rounded-lg ${filter === 'active' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-200'}`}
              >
                Active
              </button>
              <button 
                onClick={() => setFilter("completed")}
                className={`px-3 py-1 text-sm rounded-lg ${filter === 'completed' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-200'}`}
              >
                Completed
              </button>
            </div>

            {filteredTasks.length === 0 ? (
              // Empty State
              <div className="text-center p-10">
                <p className="text-gray-500 font-semibold">
                  {filter === 'all' ? 'You have no tasks!' : `No ${filter} tasks.`}
                </p>
                <p className="text-gray-400 text-sm">
                  {filter === 'all' ? 'Add one above to get started.' : 'Keep up the good work!'}
                </p>
              </div>
            ) : (
              // List
              <>
                {/* Info Bar */}
                <div className="flex justify-between items-center mb-2">
                  <p className="text-gray-500 text-sm">
                    {filteredTasks.filter(t => !t.isCompleted).length} tasks left
                  </p>
                  
                  {tasks.some(t => t.isCompleted) && (
                    <button 
                      onClick={handleClearCompleted}
                      className="text-red-500 text-sm font-medium hover:text-red-700"
                    >
                      Clear Completed
                    </button>
                  )}
                </div>
                
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext 
                    items={filteredTasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="w-full">
                      {filteredTasks.map((task) => (
                        <SortableTaskItem 
                          key={task.id} 
                          task={task} 
                          index={tasks.findIndex(t => t.id === task.id)}
                          handleToggleComplete={handleToggleComplete}
                          handleDelete={handleDelete}
                          handleUpdateTask={handleUpdateTask}
                          today={today}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </div>

        </div> 
      )} 
      {/* --- END OF CONDITIONAL RENDER --- */}
      
    </main>
  );
}