const firebaseConfig = {
  apiKey: "AIzaSyDJ3U7p98uai7GEyCemHaIzfuICqv-uWWI",
  authDomain: "smart-campus-complaint-s-29e57.firebaseapp.com",
  projectId: "smart-campus-complaint-s-29e57",
  storageBucket: "smart-campus-complaint-s-29e57.firebasestorage.app",
  messagingSenderId: "25787802812",
  appId: "1:25787802812:web:baf54fabda4ddfb1a15cb9",
  measurementId: "G-5BLB7TRZHV"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Main redirect logic - sends to correct page based on role
auth.onAuthStateChanged(user => {
  if (user) {
    db.collection('users').doc(user.uid).get().then(doc => {
      if (doc.exists) {
        const role = doc.data().role || 'user';
        if (role === 'admin') {
          if (!window.location.pathname.includes('admin.html')) {
            window.location.href = 'admin.html';
          }
        } else {
          if (!window.location.pathname.includes('dashboard.html')) {
            window.location.href = 'dashboard.html';
          }
        }
      } else {
        if (!window.location.pathname.includes('dashboard.html')) {
          window.location.href = 'dashboard.html';
        }
      }
    }).catch(() => {
      if (!window.location.pathname.includes('dashboard.html')) {
        window.location.href = 'dashboard.html';
      }
    });
  } else {
    if (!window.location.pathname.includes('index.html')) {
      window.location.href = 'index.html';
    }
  }
});

// Login / Register / Google / Logout
document.getElementById('loginForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  auth.signInWithEmailAndPassword(email, password)
    .catch(err => alert("Login failed: " + err.message));
});

document.getElementById('registerForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const campusId = document.getElementById('regCampusId').value.trim();
  const password = document.getElementById('regPassword').value;

  auth.createUserWithEmailAndPassword(email, password)
    .then(cred => {
      return db.collection('users').doc(cred.user.uid).set({
        name, email, campusId, role: 'user'
      });
    })
    .then(() => {
      auth.signOut();
      alert("Registration successful! Please log in now.");
      document.getElementById('registerForm').reset();
    })
    .catch(err => alert("Registration failed: " + err.message));
});

document.getElementById('googleLoginBtn')?.addEventListener('click', () => {
  auth.signInWithPopup(googleProvider);
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  auth.signOut();
});

// Load complaints with search support
function loadComplaints(isAdmin, currentUserUid) {
  db.collection('complaints')
    .orderBy('timestamp', 'desc')
    .onSnapshot(snapshot => {
      const allList = document.getElementById('complaintsList');
      const myList = document.getElementById('myComplaintsList');
      allList.innerHTML = '';
      if (myList) myList.innerHTML = '';

      let myPending = 0;
      let myResolved = 0;

      if (snapshot.empty) {
        allList.innerHTML = '<div class="col-12 text-center text-white"><h5>No complaints yet.</h5></div>';
        if (myList) myList.innerHTML = '<div class="col-12 text-center text-white"><h5>You have no complaints yet.</h5></div>';
      } else {
        snapshot.forEach(doc => {
          const c = doc.data();
          const isMyComplaint = c.submittedBy === currentUserUid;

          if (isMyComplaint) {
            if (c.status === 'pending') myPending++;
            else myResolved++;
          }

          const card = document.createElement('div');
          card.className = 'col-md-6 col-lg-4 mb-4 complaint-card'; // class for search
          card.setAttribute('data-search-text', `${c.title || ''} ${c.category || ''} ${c.location || ''} ${c.description || ''}`.toLowerCase());

          card.innerHTML = `
            <div class="card shadow h-100" style="border-radius: 15px;">
              <div class="card-body">
                <h5 class="card-title">${c.title}
                  <span class="badge ${c.status === 'resolved' ? 'badge-resolved' : 'badge-pending'} float-end">
                    ${c.status.toUpperCase()}
                  </span>
                </h5>
                <p class="text-muted"><strong>Category:</strong> ${c.category}</p>
                <p class="text-muted"><strong>Location:</strong> ${c.location || 'Not specified'}</p>
                <p class="text-muted"><strong>Submitted by:</strong> ${c.submittedByName || 'Anonymous'}</p>
                <p class="card-text">${c.description}</p>
                <small class="text-muted d-block mt-3">
                  ${c.timestamp ? new Date(c.timestamp.toDate()).toLocaleString() : 'Just now'}
                </small>
                ${isAdmin && c.status === 'pending' ?
                  `<button class="btn btn-success btn-lg w-100 mt-3 resolveBtn" data-id="${doc.id}">Mark as Resolved</button>` : ''}
              </div>
            </div>`;

          allList.appendChild(card.cloneNode(true));
          if (myList && isMyComplaint) {
            myList.appendChild(card);
          }
        });
      }

      // Update user stats
      if (document.getElementById('myPendingCount')) {
        document.getElementById('myPendingCount').textContent = myPending;
        document.getElementById('myResolvedCount').textContent = myResolved;
      }

      // Admin stats
      if (document.getElementById('pendingCount')) {
        const pending = snapshot.docs.filter(doc => doc.data().status === 'pending').length;
        const resolved = snapshot.docs.filter(doc => doc.data().status === 'resolved').length;
        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('resolvedCount').textContent = resolved;
        document.getElementById('totalCount').textContent = snapshot.size;
      }

      // Resolve buttons
      document.querySelectorAll('.resolveBtn').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.id;
          db.collection('complaints').doc(id).update({ status: 'resolved' })
            .then(() => alert('Complaint resolved successfully!'))
            .catch(err => alert('Error: ' + err.message));
        };
      });
    });
}

// Admin Search Bar - live filtering
document.getElementById('adminSearchInput')?.addEventListener('input', e => {
  const term = e.target.value.toLowerCase().trim();
  document.querySelectorAll('.complaint-card').forEach(card => {
    const searchText = card.getAttribute('data-search-text');
    if (searchText.includes(term)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
});

// Load on dashboard or admin page
if (window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('admin.html')) {
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }

    let role = 'user';
    let userName = user.email;

    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        role = data.role || 'user';
        userName = data.name || user.email;
      }
    } catch (err) {}

    const isAdmin = role === 'admin';

    if (window.location.pathname.includes('dashboard.html')) {
      document.getElementById('welcomeName').textContent = userName.split(' ')[0] || 'User';
      document.getElementById('userName').textContent = userName;
      document.getElementById('userEmail').textContent = user.email;
      document.getElementById('userCampusId').textContent = 'Not provided';
      document.getElementById('userRole').textContent = 'USER';
    }

    loadComplaints(isAdmin, user.uid);
  });
}

// Submit Complaint with Location
document.getElementById('complaintForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    alert('You must be logged in!');
    return;
  }

  const title = document.getElementById('title').value.trim();
  const category = document.getElementById('category').value;
  const location = document.getElementById('location').value.trim();
  const description = document.getElementById('description').value.trim();

  if (!title || !category || !description) {
    alert('Please fill all required fields.');
    return;
  }

  let submittedByName = user.email;
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      submittedByName = userDoc.data().name || user.email;
    }
  } catch (err) {}

  db.collection('complaints').add({
    title,
    category,
    location: location || 'Not specified',
    description,
    status: 'pending',
    submittedBy: user.uid,
    submittedByName,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    alert('Complaint submitted successfully!');
    bootstrap.Modal.getInstance(document.getElementById('complaintModal')).hide();
    document.getElementById('complaintForm').reset();
  })
  .catch(err => {
    alert('Submit failed: ' + err.message);
  });
});
