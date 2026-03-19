import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'weekly_summaries' })
@Unique(['userId', 'weekStart'])
export class WeeklySummaryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'date' })
  weekStart!: string;

  @Column({ type: 'int', default: 0 })
  focusSessions!: number;

  @Column({ type: 'int', default: 0 })
  focusSeconds!: number;

  @Column({ type: 'int', default: 0 })
  breakSeconds!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
