import api from "./axios";

export const authAPI = {
  login: (credentials) => api.post("/auth/login", credentials),
};

export const problemAPI = {
  getAll: () => api.get("/problems"),
  create: (data) => api.post("/problems", data),
  update: (id, data) => api.put(`/problems/${id}`, data),
};

export const submissionAPI = {
  submitCode: (data) => api.post("/submissions", data),
  getReport: (id) => api.get(`/submissions/${id}`),
  getAll: () => api.get("/submissions"),
};
