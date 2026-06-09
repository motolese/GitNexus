const std = @import("std");

pub const User = struct {
    id: u64,
    name: []const u8,

    pub fn new(id: u64, name: []const u8) User {
        return .{ .id = id, .name = name };
    }

    pub fn print(self: *const User) void {
        std.debug.print("user={d} {s}\n", .{ self.id, self.name });
    }
};

pub fn main() void {
    const user = User.new(1, "satoshi");
    user.print();
}
