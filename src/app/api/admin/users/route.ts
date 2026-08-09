import { NextResponse } from "next/server";
import {
  adminErrorMessage,
  checkAdmin,
  getServiceClient,
  missingServiceEnv,
} from "@/lib/supabase/serviceClient";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: missingServiceEnv() }, { status: 500 });
  const admin = await checkAdmin(supabase, request);
  if (!admin.ok) return NextResponse.json({ error: adminErrorMessage(admin) }, { status: 403 });

  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

  const { data: profiles } = await supabase.from("profiles").select("id, role");
  const roleById = new Map((profiles ?? []).map((p) => [p.id, p.role]));

  const users = authUsers.users.map((u) => ({
    id: u.id,
    email: u.email,
    role: roleById.get(u.id) ?? "manager",
    created_at: u.created_at,
  }));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: missingServiceEnv() }, { status: 500 });
  const admin = await checkAdmin(supabase, request);
  if (!admin.ok) return NextResponse.json({ error: adminErrorMessage(admin) }, { status: 403 });

  const { email, password, role } = (await request.json()) as {
    email: string;
    password: string;
    role: "admin" | "manager" | "director";
  };

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Could not create user" }, { status: 400 });
  }

  await supabase
    .from("profiles")
    .upsert({
      id: data.user.id,
      role: role === "admin" || role === "director" ? role : "manager",
    });

  return NextResponse.json({ id: data.user.id, email: data.user.email });
}

export async function PATCH(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: missingServiceEnv() }, { status: 500 });
  const admin = await checkAdmin(supabase, request);
  if (!admin.ok) return NextResponse.json({ error: adminErrorMessage(admin) }, { status: 403 });

  const { userId, role } = (await request.json()) as {
    userId: string;
    role: "admin" | "manager" | "director";
  };
  if (!userId || !["admin", "manager", "director"].includes(role)) {
    return NextResponse.json({ error: "Invalid userId/role" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").upsert({ id: userId, role });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: missingServiceEnv() }, { status: 500 });
  const admin = await checkAdmin(supabase, request);
  if (!admin.ok) return NextResponse.json({ error: adminErrorMessage(admin) }, { status: 403 });

  const { userId } = (await request.json()) as { userId: string };
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  if (userId === admin.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
