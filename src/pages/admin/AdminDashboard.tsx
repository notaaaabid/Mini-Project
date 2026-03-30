import { useState, useEffect, useMemo } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Medicine,
  Doctor,
  Order,
  Appointment,
} from "@/lib/data";
import { supabase } from "@/lib/supabase";
import {
  Pill,
  UserCog,
  Package,
  Calendar,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  BarChart3,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";
import { User as UserType } from "@/lib/data";

type TimePeriod = "daily" | "weekly" | "monthly";

// ===== Helper: group orders by time bucket =====
function groupOrders(orders: Order[], period: TimePeriod) {
  const map: Record<string, { label: string; revenue: number; cancelled: number; orders: number; cancelledCount: number; items: number }> = {};

  const sorted = [...orders].sort(
    (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
  );

  sorted.forEach((order) => {
    const d = new Date(order.orderDate);
    let key: string;
    let label: string;

    if (period === "daily") {
      key = order.orderDate;
      label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else if (period === "weekly") {
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      key = startOfWeek.toISOString().split("T")[0];
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      label = `${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    if (!map[key]) {
      map[key] = { label, revenue: 0, cancelled: 0, orders: 0, cancelledCount: 0, items: 0 };
    }

    if (order.status === "Cancelled") {
      map[key].cancelled += order.total || 0;
      map[key].cancelledCount += 1;
    } else {
      map[key].revenue += order.total || 0;
    }
    map[key].orders += 1;
    map[key].items += order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  });

  const entries = Object.values(map);

  if (entries.length <= 1 && sorted.length > 1) {
    let cumRevenue = 0;
    return sorted.map((order, i) => {
      const total = order.total || 0;
      const isCancelled = order.status === "Cancelled";
      if (!isCancelled) cumRevenue += total;
      return {
        label: `${i + 1}`,
        revenue: isCancelled ? 0 : total,
        cancelled: isCancelled ? total : 0,
        orders: 1,
        cancelledCount: isCancelled ? 1 : 0,
        activeOrders: isCancelled ? 0 : 1,
        items: order.items?.reduce((s, it) => s + it.quantity, 0) || 0,
        cumulativeRevenue: cumRevenue,
      };
    });
  }

  let cumRevenue = 0;
  return entries.map((entry) => {
    cumRevenue += entry.revenue;
    return { ...entry, activeOrders: entry.orders - entry.cancelledCount, cumulativeRevenue: cumRevenue };
  });
}

// ===== Tab Button =====
function PeriodTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
        active
          ? "bg-foreground text-background shadow-sm"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {label}
    </button>
  );
}

// ===== Tooltip =====
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => {
        const isMonetary = entry.name.toLowerCase().includes("revenue") || entry.name.toLowerCase().includes("income");
        return (
          <p key={i} className="flex items-center gap-2" style={{ color: entry.color }}>
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
            {entry.name}:{" "}
            <span className="font-medium">
              {isMonetary
                ? `$${entry.value.toFixed(2)}`
                : entry.value}
            </span>
          </p>
        );
      })}
    </div>
  );
}

// ===== MAIN COMPONENT =====
const AdminDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);

  const [revenuePeriod, setRevenuePeriod] = useState<TimePeriod>("daily");
  const [orderPeriod, setOrderPeriod] = useState<TimePeriod>("daily");

  const loadData = async () => {
    const { data: ords } = await supabase.from('orders').select('*');
    if (ords) setOrders(ords as Order[]);

    const { data: appts } = await supabase.from('appointments').select('*');
    if (appts) setAppointments(appts as Appointment[]);

    const { data: meds } = await supabase.from('medicines').select('*');
    if (meds) setMedicines(meds as Medicine[]);

    const { data: docs } = await supabase.from('doctors').select('*');
    if (docs) {
      const d = docs as Doctor[];
      setDoctors(Array.from(new Map(d.map(doc => [doc.name.toLowerCase().trim(), doc])).values()));
    }

    const { data: usrs } = await supabase.from('users').select('*');
    if (usrs) setUsers(usrs as UserType[]);
  };

  useEffect(() => {
    loadData();
  }, []);

  // ===== Computed =====
  const activeOrders = useMemo(() => orders.filter((o) => o.status !== "Cancelled"), [orders]);
  const cancelledOrders = useMemo(() => orders.filter((o) => o.status === "Cancelled"), [orders]);

  const pendingAppointments = useMemo(() => appointments.filter(a => a.status !== "completed"), [appointments]);

  const todaysOrders = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return orders.filter((o) => {
      const d = new Date(o.orderDate);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) === todayStr;
    });
  }, [orders]);

  const totalRevenue = useMemo(
    () => activeOrders.reduce((sum, o) => sum + (o.total || 0), 0),
    [activeOrders]
  );
  const cancelledTotal = useMemo(
    () => cancelledOrders.reduce((sum, o) => sum + (o.total || 0), 0),
    [cancelledOrders]
  );
  const totalItems = useMemo(
    () => activeOrders.reduce((sum, o) => sum + (o.items?.reduce((s, i) => s + i.quantity, 0) || 0), 0),
    [activeOrders]
  );

  const revenueData = useMemo(() => {
    const grouped = groupOrders(orders, revenuePeriod);
    return grouped.map((entry, i) => ({ ...entry, label: `${i + 1}` }));
  }, [orders, revenuePeriod]);

  const orderHistoryData = useMemo(() => groupOrders(orders, orderPeriod), [orders, orderPeriod]);

  const emptyPlaceholder = [
    { label: "No data", revenue: 0, cancelled: 0, orders: 0, cancelledCount: 0, items: 0, cumulativeRevenue: 0 },
  ];

  const stats = [
    { label: "Medicines", value: medicines.length, icon: Pill, color: "bg-blue-500" },
    { label: "Doctors", value: doctors.filter((d) => d.isActive).length, icon: UserCog, color: "bg-purple-500" },
    { label: "Pending Appointments", value: pendingAppointments.length, icon: Calendar, color: "bg-orange-500" },
  ];

  const periodLabels: Record<TimePeriod, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  };

  return (
    <div className="min-h-screen bg-background m-5">
      <AdminSidebar />
      <main className={cn("transition-all pt-16 lg:pt-0 lg:pl-64", "p-8")}>
        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground mb-8">Overview of your healthcare platform</p>

        {/* ===== TOP STATS ===== */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Income card */}
          <Card className="border-2 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-green-700 mb-1">Total Net Revenue</p>
                  <p className="text-4xl font-bold text-green-900">${totalRevenue.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-green-200 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">{activeOrders.length} Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-600">{cancelledOrders.length} Cancelled</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">{totalItems} Items</span>
                </div>
                {cancelledTotal > 0 && (
                  <span className="text-xs text-red-500">-${cancelledTotal.toFixed(2)} refunded</span>
                )}
              </div>
            </CardContent>
          </Card>

          {stats.map((stat, i) => (
            <Card key={i} className="border-2">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ===== CHARTS SIDE BY SIDE ===== */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Growth Chart */}
          <Card className="border-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="w-5 h-5 text-green-600" /> Revenue Growth
                </CardTitle>
                <div className="flex gap-1.5">
                  {(["daily", "weekly", "monthly"] as TimePeriod[]).map((p) => (
                    <PeriodTab
                      key={p}
                      active={revenuePeriod === p}
                      label={periodLabels[p]}
                      onClick={() => setRevenuePeriod(p)}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {periodLabels[revenuePeriod]} cumulative revenue growth
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData.length > 0 ? revenueData : emptyPlaceholder}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="cumulativeRevenue"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#revGrad)"
                      dot={{ r: 4, fill: "#16a34a", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6 }}
                      name="Cumulative Revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Order History Chart */}
          <Card className="border-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="w-5 h-5 text-blue-600" /> Order History
                </CardTitle>
                <div className="flex gap-1.5">
                  {(["daily", "weekly", "monthly"] as TimePeriod[]).map((p) => (
                    <PeriodTab
                      key={p}
                      active={orderPeriod === p}
                      label={periodLabels[p]}
                      onClick={() => setOrderPeriod(p)}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-blue-600">■</span> active · <span className="text-red-500">■</span> cancelled
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={orderHistoryData.length > 0 ? orderHistoryData : emptyPlaceholder}
                    barGap={2}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="activeOrders" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} name="Active Orders" />
                    <Bar dataKey="cancelledCount" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} name="Cancelled Orders" opacity={0.75} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== RECENT ACTIVITY ===== */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" /> Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todaysOrders.length > 0 ? (
                todaysOrders
                  .slice(-5)
                  .reverse()
                  .map((o) => {
                    const isCancelled = o.status === "Cancelled";
                    const d = new Date(o.orderDate);
                    const timeStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
                      ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                    return (
                      <div key={o.id} className="flex justify-between py-3 border-b last:border-0 items-center">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={o.patientName}
                            image={users.find(u => u.id === o.patientId || u.name === o.patientName)?.image}
                            className="h-9 w-9 hidden sm:block"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-foreground font-medium">{o.patientName}</span>
                              {isCancelled && (
                                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                                  CANCELLED
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {timeStr} · {o.items?.reduce((s, i) => s + i.quantity, 0) || 0} items
                            </p>
                          </div>
                        </div>
                        <span className={`font-semibold ${isCancelled ? "text-red-500" : "text-green-600"}`}>
                          {isCancelled ? "−" : "+"}${o.total.toFixed(2)}
                        </span>
                      </div>
                    );
                  })
              ) : (
                <p className="text-center py-8 text-muted-foreground">No orders yet</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Recent Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingAppointments.length > 0 ? (
                pendingAppointments
                  .slice(-5)
                  .reverse()
                  .map((a) => (
                    <div key={a.id} className="flex justify-between py-3 border-b last:border-0 items-center">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={a.patientName}
                          image={users.find(u => u.name === a.patientName && u.role === 'patient')?.image}
                          className="h-8 w-8"
                        />
                        <span className="text-foreground text-sm font-medium">{a.patientName}</span>
                      </div>
                      <div className="flex items-center justify-end gap-2 max-w-[50%]">
                        <span className="text-muted-foreground text-sm truncate">{a.doctorName}</span>
                        <UserAvatar
                          name={a.doctorName}
                          image={doctors.find(d => d.name === a.doctorName)?.image}
                          className="h-8 w-8 hidden sm:flex"
                        />
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-center py-8 text-muted-foreground">No appointments yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
