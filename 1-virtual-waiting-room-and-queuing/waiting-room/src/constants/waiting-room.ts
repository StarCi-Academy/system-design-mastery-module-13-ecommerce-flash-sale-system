/**
 * Hằng số phòng chờ — key Redis và ngưỡng admit.
 * (EN: Waiting room constants — Redis keys and admit threshold.)
 */
export const WAITING_ROOM_QUEUE_KEY = "waitingroom:queue"

/** SET user đã được duyệt vào checkout (TTL 5 phút). */
export const WAITING_ROOM_ADMITTED_KEY = "waitingroom:admitted"

/** TTL danh sách admitted (giây) — demo 5 phút. */
export const WAITING_ROOM_ADMITTED_TTL_SEC = 300

/** Số user mặc định khi POST admit không truyền count. */
export const WAITING_ROOM_DEFAULT_ADMIT_COUNT = 50
