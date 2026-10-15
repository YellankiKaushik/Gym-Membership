import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  RefreshCw,
  LogOut,
  Loader2,
  ChevronDown,
  X,
  Save,
  AlertTriangle,
  Search,
  Trash2,
  Clock3,
  ArrowRight,
} from "lucide-react";
import { Alert, Button, EmptyState } from "../components/ui";
import OwnerLogin from "../components/OwnerLogin";
import DashboardSummary from "../components/DashboardSummary";
import MemberList from "../components/MemberList";
import {
  getAllMembers,
  loginOwner,
  logoutOwner,
  isAdminLoggedIn,
  getSessionExpiresAt,
  SESSION_ENDED_EVENT,
  addMember,
  renewMembership,
  deleteMember,
  getApiUrl,
  updateMember,
} from "../api/gymApi";
import type { Member, NewMemberData } from "../types/member";
import MemberDialog from "../components/MemberDialog";
import {
  MEMBERSHIP_PLANS,
  gymToday,
  isMembershipDate,
  suggestedRenewalStart,
  renewalDateError,
  dayAfter,
  memberSummary,
  filterMembers,
  type MembershipFilter,
} from "../utils/membership";

type ModalType = "add" | "edit" | "renew" | "delete" | null;

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(isAdminLoggedIn);
  const [ownerId, setOwnerId] = useState("");
  const requestVersion = useRef(0);
  const loginAttempt = useRef(0);
  const [password, setPassword] = useState("");
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [filter, setFilter] = useState<MembershipFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form state for add/edit
  const [formData, setFormData] = useState<Partial<NewMemberData>>({
    id: "",
    name: "",
    phone: "",
    age: 0,
    weight: 0,
    membershipType: "3 Months",
    startDate: gymToday(),
  });

  // Renewal form state
  const [renewalData, setRenewalData] = useState({
    membershipType: "3 Months" as Member["membershipType"],
    startDate: gymToday(),
  });

  const resetOwnerView = useCallback(() => {
    requestVersion.current += 1;
    loginAttempt.current += 1;
    setIsAuthenticated(false);
    setMembers([]);
    setModal(null);
    setSelectedMember(null);
    setFormData({});
    setPassword("");
    setSuccess(null);
    setLoading(false);
  }, []);

  const handleLogout = useCallback(async () => {
    const pending = logoutOwner(); // Captures token, immediately clears browser session.
    resetOwnerView();
    const version = requestVersion.current;
    const response = await pending;
    if (version !== requestVersion.current) return;
    if (!response.success && response.code !== "UNAUTHORIZED") {
      setError(
        "Signed out locally. Server logout could not be confirmed; the session expires within 30 minutes.",
      );
    }
  }, [resetOwnerView]);

  const fetchMembers = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const response = await getAllMembers();
      if (version !== requestVersion.current || !isAdminLoggedIn()) return;
      if (response.success && Array.isArray(response.members)) {
        setMembers(response.members);
        setLastRefresh(
          new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date()),
        );
      } else {
        setError(response.error || "Failed to fetch members");
      }
    } catch {
      if (version === requestVersion.current)
        setError("Failed to fetch members");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdminLoggedIn()) void fetchMembers();
    return () => {
      requestVersion.current += 1;
      loginAttempt.current += 1;
    };
  }, [fetchMembers]);

  useEffect(() => {
    const onSessionEnded = () => {
      resetOwnerView();
      setError("Session ended. Please log in again.");
    };
    window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    return () =>
      window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
  }, [resetOwnerView]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const expiresAt = getSessionExpiresAt();
    if (!expiresAt) return;
    // Activity cannot extend this absolute server-issued expiration.
    const absoluteTimer = window.setTimeout(
      () => {
        void handleLogout();
      },
      Math.max(0, expiresAt - Date.now()),
    );
    let idleTimer: number;
    const resetTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(
        () => {
          void handleLogout();
        },
        30 * 60 * 1000,
      );
    };
    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      window.clearTimeout(absoluteTimer);
      window.clearTimeout(idleTimer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated, handleLogout]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!getApiUrl()) {
      setError(
        "Owner login is currently unavailable. Ask the installer to configure this gym.",
      );
      return;
    }
    const pending = loginOwner(ownerId.trim(), password);
    const attempt = ++loginAttempt.current;
    setLoading(true);
    setError(null);
    try {
      const response = await pending;
      if (
        attempt !== loginAttempt.current ||
        response.code === "LOGIN_CANCELLED"
      )
        return;
      setPassword("");
      if (response.success) {
        setIsAuthenticated(true);
        await fetchMembers();
      } else {
        setError(response.error || "Login failed");
      }
    } catch {
      if (attempt === loginAttempt.current)
        setError("Login failed. Please try again.");
    } finally {
      if (attempt === loginAttempt.current) {
        setPassword("");
        setLoading(false);
      }
    }
  };

  const openAddModal = () => {
    setError(null);
    setFormData({
      id: "",
      name: "",
      phone: "",
      age: 25,
      weight: 70,
      membershipType: "3 Months",
      startDate: gymToday(),
    });
    setModal("add");
  };

  const openEditModal = (member: Member) => {
    setError(null);
    setSelectedMember(member);
    setFormData({
      id: member.id,
      name: member.name,
      phone: member.phone,
      age: member.age,
      weight: member.weight,
      membershipType: member.membershipType,
      startDate: member.startDate,
    });
    setModal("edit");
  };

  const openRenewModal = (member: Member) => {
    setError(null);
    setSelectedMember(member);
    setRenewalData({
      membershipType: member.membershipType,
      startDate: suggestedRenewalStart(member.endDate),
    });
    setModal("renew");
  };

  const openDeleteModal = (member: Member) => {
    setError(null);
    setSelectedMember(member);
    setModal("delete");
  };

  const closeModal = useCallback(() => {
    setModal(null);
    setSelectedMember(null);
    setError(null);
  }, []);

  const handleAddMember = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();

    const version = requestVersion.current;
    const name = String(formData.name || "").trim();
    const phone = String(formData.phone || "").trim();
    const age = Number(formData.age);
    const weight = Number(formData.weight);
    const startDate = String(formData.startDate || "").trim();

    if (!name) {
      setError("Name is required");
      return;
    }
    if (
      !/^[+\d ()-]+$/.test(phone) ||
      !/^(?:91)?\d{10}$/.test(phone.replace(/\D/g, ""))
    ) {
      setError("Enter a 10-digit phone number, optionally with +91.");
      return;
    }
    if (!Number.isInteger(age) || age <= 0 || age > 120) {
      setError("Age must be a whole number from 1 to 120.");
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
      setError("Weight must be greater than 0, up to 500 kg.");
      return;
    }
    if (!isMembershipDate(startDate)) {
      setError("Enter a valid start date as YYYY-MM-DD.");
      return;
    }

    setLoading(true);
    setError(null);

    const newMemberData: NewMemberData = {
      name: name,
      phone: phone,
      age: age,
      weight: weight,
      membershipType: formData.membershipType || "3 Months",
      startDate: startDate,
    };

    try {
      const response = await addMember(newMemberData);

      if (version !== requestVersion.current || !isAdminLoggedIn()) return;
      if (response.success) {
        setSuccess(
          `Member added. ID: ${response.memberId || "refresh to confirm"}`,
        );
        closeModal();
        await fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || "Failed to add member");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      if (version === requestVersion.current && isAdminLoggedIn())
        setLoading(false);
    }
  };

  const handleEditMember = async (e?: React.MouseEvent) => {
    e?.preventDefault();

    if (!selectedMember) {
      setError("No member selected for editing");
      return;
    }

    const version = requestVersion.current;
    const rawName = String(formData.name || "").trim();
    const rawPhone = String(formData.phone || "").trim();
    const rawAge = Number(formData.age);
    const rawWeight = Number(formData.weight);
    const rawStartDate = String(formData.startDate || "").trim();

    if (!rawName) {
      setError("Name is required");
      return;
    }
    if (
      !/^[+\d ()-]+$/.test(rawPhone) ||
      !/^(?:91)?\d{10}$/.test(rawPhone.replace(/\D/g, ""))
    ) {
      setError("Enter a 10-digit phone number, optionally with +91.");
      return;
    }
    if (!Number.isInteger(rawAge) || rawAge <= 0 || rawAge > 120) {
      setError("Age must be a whole number from 1 to 120.");
      return;
    }
    if (!Number.isFinite(rawWeight) || rawWeight <= 0 || rawWeight > 500) {
      setError("Weight must be greater than 0, up to 500 kg.");
      return;
    }
    if (!isMembershipDate(rawStartDate)) {
      setError("Enter a valid start date as YYYY-MM-DD.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload: Member = {
      id: selectedMember.id,
      version: selectedMember.version,
      name: rawName,
      phone: rawPhone,
      age: rawAge,
      weight: rawWeight,
      membershipType: formData.membershipType || selectedMember.membershipType,
      startDate: rawStartDate,
      endDate: selectedMember.endDate,
      status: selectedMember.status,
    };

    try {
      const response = await updateMember(payload as Member);

      if (version !== requestVersion.current || !isAdminLoggedIn()) return;
      if (response.success) {
        setSuccess("Member updated successfully!");
        closeModal();
        await fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || "Failed to update member");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update member");
    } finally {
      if (version === requestVersion.current && isAdminLoggedIn())
        setLoading(false);
    }
  };

  const handleRenewMember = async () => {
    if (!selectedMember) return;
    const dateError = renewalDateError(
      renewalData.startDate,
      selectedMember.endDate,
    );
    if (dateError) {
      setError(dateError);
      return;
    }
    const version = requestVersion.current;
    setLoading(true);
    setError(null);

    try {
      const response = await renewMembership({
        memberId: selectedMember.id,
        expectedVersion: selectedMember.version,
        membershipType: renewalData.membershipType,
        startDate: renewalData.startDate,
      });
      if (version !== requestVersion.current || !isAdminLoggedIn()) return;
      if (response.success) {
        setSuccess(
          `Membership renewed! New end date: ${response.newEndDate || "refresh the member list to confirm"}`,
        );
        closeModal();
        await fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || "Failed to renew membership");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to renew membership",
      );
    } finally {
      if (version === requestVersion.current && isAdminLoggedIn())
        setLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedMember) return;
    const version = requestVersion.current;
    setLoading(true);
    setError(null);

    try {
      const response = await deleteMember(
        selectedMember.id,
        selectedMember.version,
      );
      if (version !== requestVersion.current || !isAdminLoggedIn()) return;
      if (response.success) {
        setSuccess("Member deleted successfully!");
        closeModal();
        await fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || "Failed to delete member");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete member");
    } finally {
      if (version === requestVersion.current && isAdminLoggedIn())
        setLoading(false);
    }
  };

  const filteredMembers = filterMembers(members, filter, searchTerm);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMembers.length / itemsPerPage),
  );
  const page = Math.min(currentPage, totalPages);
  const paginatedMembers = filteredMembers.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  const stats = memberSummary(members);

  if (!isAuthenticated)
    return (
      <OwnerLogin
        ownerId={ownerId}
        password={password}
        loading={loading}
        error={error}
        onOwnerId={setOwnerId}
        onPassword={setPassword}
        onSubmit={handleLogin}
      />
    );

  const emptyTitle = searchTerm
    ? "No matching members"
    : (
        {
          all: "Your community starts here",
          active: "No active members",
          expiring: "No upcoming expirations",
          expired: "No expired members",
        } as const
      )[filter];
  return (
    <div className="dashboard page-container">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">YOUR GYM, IN FOCUS</p>
          <h1>Owner Dashboard</h1>
          <p className="text-secondary">
            A little clarity. More room for progress.
          </p>
        </div>
        <div className="dashboard-heading-actions">
          <Button variant="quiet" onClick={handleLogout}>
            <LogOut size={17} aria-hidden="true" />
            Logout
          </Button>
          <Button variant="primary" onClick={openAddModal} disabled={loading}>
            <Plus size={18} aria-hidden="true" />
            Add Member
          </Button>
        </div>
      </div>
      {success && <Alert success>{success}</Alert>}
      <DashboardSummary stats={stats} />
      {stats.expiring > 0 && (
        <div className="attention-bar">
          <Clock3 size={20} aria-hidden="true" />
          <p>
            <strong>
              {stats.expiring}{" "}
              {stats.expiring === 1 ? "membership needs" : "memberships need"}{" "}
              attention.
            </strong>{" "}
            Expiring today or within 7 days.
          </p>
          <Button onClick={() => setFilter("expiring")}>
            View expiring
            <ArrowRight size={15} aria-hidden="true" />
          </Button>
        </div>
      )}
      <section
        className="members-workspace surface"
        aria-labelledby="members-title"
        aria-busy={loading}
      >
        <div className="workspace-heading">
          <div>
            <h2 id="members-title">
              Members <span className="count-pill">{members.length}</span>
            </h2>
            <p className="refresh-note" role="status">
              {loading
                ? "Refreshing members…"
                : lastRefresh
                  ? "Last refreshed at " + lastRefresh + " IST"
                  : "Refresh to load Google Sheets changes"}
            </p>
          </div>
          <Button
            aria-label="Refresh members"
            onClick={fetchMembers}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "spin" : ""}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>
        <div className="member-toolbar">
          <div className="filter-tabs" role="group" aria-label="Filter members">
            {(
              [
                ["all", "All"],
                ["active", "Active"],
                ["expiring", "Expiring Soon"],
                ["expired", "Expired"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="search-field">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search members by ID, name, or phone"
              placeholder="Search ID, name or phone"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <Button
                variant="quiet"
                aria-label="Clear member search"
                onClick={() => setSearchTerm("")}
              >
                <X size={17} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        {error && !modal && (
          <Alert>
            <strong>Unable to complete action. </strong>
            {error}
          </Alert>
        )}
        {loading && members.length === 0 ? (
          <div className="loading-state" role="status">
            <Loader2 className="spin" size={24} aria-hidden="true" />
            Loading members
          </div>
        ) : filteredMembers.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            action={
              members.length === 0 ? (
                <Button variant="primary" onClick={openAddModal}>
                  Add Member
                </Button>
              ) : searchTerm || filter !== "all" ? (
                <Button
                  onClick={() => {
                    setSearchTerm("");
                    setFilter("all");
                  }}
                >
                  Show all members
                </Button>
              ) : undefined
            }
          >
            {members.length === 0
              ? "Add your first member and make room for their progress."
              : searchTerm
                ? "Try another name, member ID or phone number."
                : "No memberships in this category. Your full member list is one click away."}
          </EmptyState>
        ) : (
          <MemberList
            members={paginatedMembers}
            busy={loading}
            onEdit={openEditModal}
            onRenew={openRenewModal}
            onDelete={openDeleteModal}
          />
        )}
        <div className="list-footer">
          <p>
            {filteredMembers.length
              ? "Showing " +
                ((page - 1) * itemsPerPage + 1) +
                "–" +
                Math.min(page * itemsPerPage, filteredMembers.length) +
                " of " +
                filteredMembers.length
              : "0 members"}
            <span> · Changes in Sheets appear after refresh</span>
          </p>
          {totalPages > 1 && (
            <nav className="pagination" aria-label="Member pages">
              <Button
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.max(1, Math.min(prev, totalPages) - 1),
                  )
                }
                disabled={page === 1 || loading}
              >
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={page === totalPages || loading}
              >
                Next
              </Button>
            </nav>
          )}
        </div>
      </section>
      {modal && (
        <MemberDialog busy={loading} onClose={closeModal}>
          {/* Modal Header */}
          <div className="dialog-heading">
            <h2 id="member-dialog-title" className="dialog-title">
              {modal === "add" && "Add New Member"}
              {modal === "edit" && "Edit Member"}
              {modal === "renew" && "Renew Membership"}
              {modal === "delete" && "Delete Member"}
            </h2>
            <button
              onClick={closeModal}
              disabled={loading}
              aria-label="Close member dialog"
              className="btn btn-quiet dialog-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div
              id="member-form-error"
              role="alert"
              className="alert alert-danger"
            >
              {error}
            </div>
          )}

          {/* Add/Edit Form */}
          {(modal === "add" || modal === "edit") && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (modal === "add") void handleAddMember();
                else void handleEditMember();
              }}
            >
              <fieldset
                disabled={loading}
                className="form-stack"
                aria-describedby={error ? "member-form-error" : undefined}
              >
                {modal === "edit" && (
                  <div>
                    <label htmlFor="edit-member-id" className="field-label">
                      Member ID
                    </label>
                    <input
                      id="edit-member-id"
                      type="text"
                      value={formData.id || ""}
                      className="field"
                      disabled
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="member-name" className="field-label">
                    Name
                  </label>
                  <input
                    id="member-name"
                    required
                    maxLength={120}
                    type="text"
                    value={formData.name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor="member-phone" className="field-label">
                    Phone
                  </label>
                  <input
                    id="member-phone"
                    required
                    maxLength={24}
                    autoComplete="tel"
                    type="tel"
                    value={formData.phone || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="field"
                  />
                </div>
                <div className="form-pair">
                  <div>
                    <label htmlFor="member-age" className="field-label">
                      Age
                    </label>
                    <input
                      id="member-age"
                      required
                      min={1}
                      max={120}
                      step={1}
                      inputMode="numeric"
                      type="number"
                      value={formData.age || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          age: Number(e.target.value) || 0,
                        })
                      }
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor="member-weight" className="field-label">
                      Weight (kg)
                    </label>
                    <input
                      id="member-weight"
                      required
                      min={0.1}
                      max={500}
                      step="any"
                      inputMode="decimal"
                      type="number"
                      value={formData.weight || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          weight: Number(e.target.value) || 0,
                        })
                      }
                      className="field"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="member-plan" className="field-label">
                    Membership Type
                  </label>
                  <div className="relative">
                    <select
                      id="member-plan"
                      value={formData.membershipType || "3 Months"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          membershipType: e.target
                            .value as Member["membershipType"],
                        })
                      }
                      className="field"
                    >
                      {MEMBERSHIP_PLANS.map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="select-chevron" />
                  </div>
                </div>
                {modal === "edit" && (
                  <p className="form-hint">
                    Changing the start date or plan recalculates expiry.
                    Contact-only edits preserve the existing expiry.
                  </p>
                )}
                <div>
                  <label htmlFor="member-start" className="field-label">
                    Start Date
                  </label>
                  <input
                    id="member-start"
                    required
                    min="1900-01-01"
                    max="9999-12-31"
                    type="date"
                    value={formData.startDate || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="field"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary full-width"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {modal === "add" ? "Add Member" : "Save Changes"}
                    </>
                  )}
                </button>
              </fieldset>
            </form>
          )}

          {/* Renew Form */}
          {modal === "renew" && selectedMember && (
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                void handleRenewMember();
              }}
            >
              <fieldset disabled={loading} className="form-stack">
                <div className="renew-summary">
                  <p className="text-secondary text-sm">
                    Renewing membership for:
                  </p>
                  <p className="font-semibold">
                    {selectedMember.name} ({selectedMember.id})
                  </p>
                  <p className="text-secondary text-sm">
                    Current: {selectedMember.membershipType} • Expires:{" "}
                    {selectedMember.endDate}
                  </p>
                </div>
                <div>
                  <label htmlFor="renew-plan" className="field-label">
                    New Membership Type
                  </label>
                  <div className="relative">
                    <select
                      id="renew-plan"
                      value={renewalData.membershipType}
                      onChange={(e) =>
                        setRenewalData({
                          ...renewalData,
                          membershipType: e.target
                            .value as Member["membershipType"],
                        })
                      }
                      className="field"
                    >
                      {MEMBERSHIP_PLANS.map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="select-chevron" />
                  </div>
                </div>
                <div>
                  <label htmlFor="renew-start" className="field-label">
                    New Start Date
                  </label>
                  <input
                    id="renew-start"
                    type="date"
                    value={renewalData.startDate}
                    min={dayAfter(selectedMember.endDate)}
                    onChange={(e) =>
                      setRenewalData({
                        ...renewalData,
                        startDate: e.target.value,
                      })
                    }
                    className="field"
                  />
                </div>
                <p className="form-hint">
                  Current expiry is inclusive. Renewal must start after{" "}
                  {selectedMember.endDate}. The suggested date preserves paid
                  time. Your entered date is used exactly; an overlap is
                  rejected. Choosing a later date leaves a gap.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary full-width"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      Renew Membership
                    </>
                  )}
                </button>
              </fieldset>
            </form>
          )}

          {/* Delete Confirmation */}
          {modal === "delete" && selectedMember && (
            <div className="form-stack">
              <div className="delete-warning">
                <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-3" />
                <p className="font-semibold">Are you sure?</p>
                <p className="text-secondary text-sm">
                  This will permanently delete{" "}
                  <strong>{selectedMember.name}</strong> ({selectedMember.id})
                  from the system.
                </p>
              </div>
              <div className="dialog-actions">
                <button
                  onClick={closeModal}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteMember}
                  disabled={loading}
                  className="btn btn-danger"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </MemberDialog>
      )}
    </div>
  );
}
