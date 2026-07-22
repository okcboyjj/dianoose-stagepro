import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Music, List, Users, Star, Check, X, HelpCircle, Bell, Clock, ChevronRight, Calendar, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const ServiceAssignmentEntity = base44.entities.ServiceAssignment;

function CountdownTimer({ church }) {
  const [time, setTime] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [nextDate, setNextDate] = useState("");
  const [isToday, setIsToday] = useState(false);

  useEffect(() => {
    const getDayNum = (d) => ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].indexOf(d);
    const tick = () => {
      const now = new Date();
      const targetDay = getDayNum(church?.service_day || "Sunday");
      const [h, m] = (church?.service_time || "10:00").split(":").map(Number);
      let next = new Date(now);
      const diff = (targetDay - now.getDay() + 7) % 7;
      next.setDate(now.getDate() + (diff === 0 && (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) ? 7 : diff));
      next.setHours(h, m, 0, 0);
      const todayCheck = diff === 0 && now.getHours() < h + 2;
      setIsToday(todayCheck);
      setNextDate(next.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
      const delta = Math.max(0, Math.floor((next - now) / 1000));
      setTime({ days: Math.floor(delta / 86400), hours: Math.floor((delta % 86400) / 3600), mins: Math.floor((delta % 3600) / 60), secs: delta % 60 });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [church]);

  return (
    <div className="glass-panel bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-center gap-2 mb-1.5 relative z-10">
        {isToday ? (
          <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> TODAY&apos;S SET
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-widest">
            <Clock className="w-3.5 h-3.5" /> Next Service
          </span>
        )}
      </div>
      <p className="text-lg text-foreground font-semibold mb-1 relative z-10">{church?.service_name || "Morning Worship"}</p>
      <p className="text-xs text-muted-foreground mb-5 relative z-10 font-medium">{nextDate}</p>
      <div className="flex items-end gap-3 relative z-10">
        {[{ val: time.days, label: "Days" }, { val: time.hours, label: "Hours" }, { val: time.mins, label: "Mins" }, { val: time.secs, label: "Secs" }].map((item, i) => (
          <div key={i} className="flex items-end gap-3">
            <div className="text-center group">
              <div className="bg-background/80 backdrop-blur-md border border-border/50 rounded-xl w-14 h-16 flex items-center justify-center shadow-inner transition-transform group-hover:-translate-y-1 duration-300">
                <span className="text-2xl font-bold text-foreground tabular-nums">{String(item.val).padStart(2, "0")}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider font-semibold">{item.label}</div>
            </div>
            {i < 3 && <span className="text-primary/50 font-bold text-xl pb-6">:</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignmentCard({ assignment, service, onStatusUpdate }) {
  const [updating, setUpdating] = useState(false);

  const updateStatus = async (status) => {
    setUpdating(true);
    try {
      await ServiceAssignmentEntity.update(assignment.id, { status });
      onStatusUpdate();
    } finally { setUpdating(false); }
  };

  const STATUS_COLORS = {
    pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    accepted: "text-green-400 bg-green-400/10 border-green-400/20",
    declined: "text-red-400 bg-red-400/10 border-red-400/20",
    maybe: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  };

  return (
    <div className="bg-card/60 border border-border/40 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{service?.name || "Service"}</p>
          <p className="text-xs text-muted-foreground">
            {service?.date ? new Date(service.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}
            {assignment.role_in_service ? ` · ${assignment.role_in_service}` : ""}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border uppercase ${STATUS_COLORS[assignment.status] || STATUS_COLORS.pending}`}>
          {assignment.status || "pending"}
        </span>
      </div>
      {assignment.status === "pending" && (
        <div className="flex gap-2">
          <button onClick={() => updateStatus("accepted")} disabled={updating} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold hover:bg-green-500/20 transition-colors active:scale-95">
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
          <button onClick={() => updateStatus("maybe")} disabled={updating} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-colors active:scale-95">
            <HelpCircle className="w-3.5 h-3.5" /> Maybe
          </button>
          <button onClick={() => updateStatus("declined")} disabled={updating} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors active:scale-95">
            <X className="w-3.5 h-3.5" /> Decline
          </button>
        </div>
      )}
    </div>
  );
}

function UpcomingServiceCard({ service, songs, onClick }) {
  const daysUntil = Math.ceil((new Date(service.date) - new Date()) / (1000 * 60 * 60 * 24));
  const isToday = daysUntil === 0;
  const isTomorrow = daysUntil === 1;

  return (
    <div onClick={onClick} className="bg-card/60 border border-border/40 rounded-xl p-4 hover:border-primary/40 transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isToday && <span className="text-[10px] font-bold text-green-400 bg-green-400/10 rounded-full px-2 py-0.5">TODAY</span>}
            {isTomorrow && <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 rounded-full px-2 py-0.5">TOMORROW</span>}
            {!isToday && !isTomorrow && daysUntil <= 7 && <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">THIS WEEK</span>}
          </div>
          <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{service.name}</p>
          <p className="text-xs text-muted-foreground">
            {service.date ? new Date(service.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}
            {service.time ? ` · ${service.time}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-foreground">{daysUntil === 0 ? "Today" : `${daysUntil}d`}</p>
          <p className="text-[10px] text-muted-foreground">{(service.songs || []).length} songs</p>
        </div>
      </div>
      {(service.songs || []).length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {(service.songs || []).slice(0, 3).map(songId => {
            const song = songs?.find(s => s.id === songId);
            return song ? (
              <span key={songId} className="text-[10px] bg-secondary/60 text-muted-foreground rounded-md px-2 py-0.5 truncate max-w-[120px]">{song.title}</span>
            ) : null;
          })}
          {(service.songs || []).length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{(service.songs || []).length - 3} more</span>
          )}
        </div>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-2 ml-auto" />
    </div>
  );
}

export default function DashboardSection({ church, user, songs, services, members, myLibrary, notifications, onNavigate, onRefresh }) {
  const [assignments, setAssignments] = useState([]);

  const userId = user?.user_id || user?.id;

  const reloadAssignments = () => {
    if (!userId) return;
    ServiceAssignmentEntity.filter({ user_id: userId, status: "pending" }).then(setAssignments).catch(() => {});
  };

  useEffect(() => { reloadAssignments(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upcomingServices = services
    .filter(s => s.date && new Date(s.date) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6 pb-12">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-1">
              {greeting}{user?.first_name ? `, ${user.first_name}!` : "!"}
            </h1>
            <p className="text-sm text-muted-foreground font-medium">Here's everything you need for this week.</p>
          </div>
          {unreadCount > 0 && (
            <button onClick={() => onNavigate("notifications")} className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
              <Bell className="w-3.5 h-3.5" /> {unreadCount} new
            </button>
          )}
        </div>
      </motion.div>

      {/* Countdown */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <CountdownTimer church={church} />
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Songs", value: songs.length, icon: Music, color: "text-primary", bg: "bg-primary/10", nav: "songs" },
            { label: "Services", value: services.length, icon: List, color: "text-primary", bg: "bg-primary/10", nav: "services" },
            { label: "Team Members", value: members.length, icon: Users, color: "text-primary", bg: "bg-primary/10", nav: "musicians" },
            { label: "My Library", value: myLibrary.length, icon: Star, color: "text-primary", bg: "bg-primary/10", nav: "mylibrary" }
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
              <div onClick={() => onNavigate(stat.nav)} className="glass-panel rounded-2xl p-4 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group cursor-pointer">
                <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</div>
                <div className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Pending Assignments */}
      {assignments.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-foreground">Pending Invitations</h2>
            <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 rounded-full px-2 py-0.5">{assignments.length} pending</span>
          </div>
          <div className="space-y-2">
            {assignments.map(a => {
              const svc = services.find(s => s.id === a.service_id);
              return (
                <AssignmentCard
                  key={a.id}
                  assignment={a}
                  service={svc}
                  onStatusUpdate={() => { reloadAssignments(); onRefresh(); }}
                />
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Upcoming Services */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">Upcoming Services</h2>
          <button onClick={() => onNavigate("services")} className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {upcomingServices.length === 0 ? (
          <div className="bg-card/40 border border-border/30 rounded-xl p-6 text-center">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No upcoming services scheduled</p>
            <Button onClick={() => onNavigate("services")} size="sm" className="mt-3 bg-primary text-primary-foreground rounded-xl text-xs h-8">
              <Plus className="w-3 h-3 mr-1" /> Plan a Service
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingServices.map(svc => (
              <UpcomingServiceCard key={svc.id} service={svc} songs={songs} onClick={() => onNavigate("services")} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-base font-bold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Plan a Service", icon: Calendar, nav: "services" },
            { label: "Browse Songs", icon: Music, nav: "songs" },
            { label: "My Library", icon: Star, nav: "mylibrary" },
            { label: "Team Messages", icon: Users, nav: "messages" },
          ].map((qa, i) => (
            <button key={i} onClick={() => onNavigate(qa.nav)} className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-gradient-to-br from-primary/20 to-primary/5 hover:border-primary/40 transition-all group">
              <qa.icon className="w-5 h-5 text-foreground opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              <span className="text-xs font-semibold text-foreground">{qa.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}