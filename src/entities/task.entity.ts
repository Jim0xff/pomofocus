import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type TaskStatus = 'PENDING' | 'ACTIVE' | 'DONE' | 'ARCHIVED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH';

@Entity({ name: 'tasks' })
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status!: TaskStatus;

  @Column({ type: 'varchar', length: 16, default: 'NORMAL' })
  priority!: TaskPriority;

  @Column({ type: 'int', default: 1 })
  estimatedPomodoros!: number;

  @Column({ type: 'int', default: 0 })
  actualPomodoros!: number;

  @Column({ nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
