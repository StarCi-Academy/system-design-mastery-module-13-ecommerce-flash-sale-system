import {
    Injectable,
} from "@nestjs/common"

/**
 * Service demonstrating virtual waiting-room queue tokens.
 */
@Injectable()
export class WaitingroomService {
    private readonly queue = new Map<string, number>()

    /**
     * Issues or returns a queue token for a user.
     *
     * @param userId - User id
     * @returns Queue token and position
     */
    issueToken(userId: string) {
        if (!this.queue.has(userId)) {
            this.queue.set(userId, Date.now() + this.queue.size)
        }

        const orderedUsers = this.getOrderedUsers()
        const position = orderedUsers.indexOf(userId) + 1

        return {
            userId,
            token: `wr_${Buffer.from(userId).toString("hex")}`,
            position,
            estimatedWaitSeconds: Math.max(0, (position - 1) * 5),
            policy: "admit-fixed-rate-to-checkout",
        }
    }

    /**
     * Admits the next users into checkout.
     *
     * @param limit - Number of users to admit
     * @returns Admitted users
     */
    admit(limit: number) {
        const admitted = this.getOrderedUsers().slice(0, limit)

        for (const userId of admitted) {
            this.queue.delete(userId)
        }

        return {
            admitted,
            remaining: this.queue.size,
        }
    }

    private getOrderedUsers(): Array<string> {
        return Array.from(this.queue.entries())
            .sort((left, right) => left[1] - right[1])
            .map(([userId]) => userId)
    }
}
