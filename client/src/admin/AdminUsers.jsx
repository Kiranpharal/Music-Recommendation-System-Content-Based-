import { useEffect, useState } from "react";
import { adminFetchUsers, adminPromote, adminDemote, adminDeleteUser } from "../api/api";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    adminFetchUsers().then(setUsers);
  }, []);

  const refresh = () => adminFetchUsers().then(setUsers);

  return (
    <div>
      <h1 style={{ marginBottom: "20px" }}>User Management</h1>

      <table style={{
        width: "100%",
        background: "#1e293b",
        borderRadius: "8px",
        padding: "10px",
      }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#94a3b8" }}>
            <th>ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Admin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderTop: "1px solid #334155" }}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>{u.is_admin ? "Yes" : "No"}</td>
              <td>
                {!u.is_admin ? (
                  <button onClick={() => adminPromote(u.id).then(refresh)}>Promote</button>
                ) : (
                  <button onClick={() => adminDemote(u.id).then(refresh)}>Demote</button>
                )}
                <button
                  style={{ marginLeft: "10px", color: "red" }}
                  onClick={() => adminDeleteUser(u.id).then(refresh)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
