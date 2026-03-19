import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'user_settings' })
export class UserSettingsEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'int', default: 25 })
  focusMinutes!: number;

  @Column({ type: 'int', default: 5 })
  shortBreakMinutes!: number;

  @Column({ type: 'int', default: 15 })
  longBreakMinutes!: number;

  @Column({ type: 'int', default: 4 })
  longBreakInterval!: number;

  @Column({ type: 'varchar', length: 32, default: 'classic' })
  alarmSound!: string;

  @Column({ type: 'varchar', length: 32, default: 'none' })
  backgroundSound!: string;

  @Column({ type: 'int', default: 80 })
  volume!: number;

  @Column({ type: 'simple-json', nullable: true })
  options?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
