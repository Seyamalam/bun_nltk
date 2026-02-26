pub const ErrorCode = enum(u32) {
    ok = 0,
    invalid_n = 1,
    out_of_memory = 2,
    insufficient_capacity = 3,
};

pub const CountError = error{
    InvalidN,
    OutOfMemory,
    InsufficientCapacity,
};
