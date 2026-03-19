import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type TimerPhase = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
export type TimerStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

@Entity({ name: 'timer_sessions' })
export class TimerSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  taskId?: string | null;

  @Column({ type: 'varchar', length: 16 })
  phase!: TimerPhase;

  @Column({ type: 'varchar', length: 16 })
  status!: TimerStatus;

  @Column({ type: 'int' })
  plannedDurationSeconds!: number;

  @Column({ type: 'int', default: 0 })
  elapsedSeconds!: number;

  @Column({ nullable: true })
  startedAt?: Date | null;

  @Column({ nullable: true })
  pausedAt?: Date | null;

  @Column({ nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  completedPomodoros!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
